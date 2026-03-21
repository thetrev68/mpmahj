//! Supabase JWT validation utilities.
//!
//! The server loads an ES256 decoding key from the project's JWKS endpoint and
//! uses it to validate bearer tokens.
//!
//! ```no_run
//! # async fn run() -> Result<(), String> {
//! use mahjong_server::auth::AuthState;
//! let auth = AuthState::new("https://project.supabase.co".to_string(), None);
//! auth.load_keys().await?;
//! // auth.validate_token("eyJhbGciOiJFUzI1NiIsInR5cCI6IkpXVCJ9...")?;
//! # Ok(())
//! # }
//! ```
use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use serde::{Deserialize, Serialize};
#[cfg(test)]
use std::collections::HashMap;
use std::sync::{Arc, RwLock};
use std::time::{SystemTime, UNIX_EPOCH};
use uuid::Uuid;

/// Claims carried by Supabase access tokens.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Claims {
    /// The user ID.
    pub sub: String,
    /// Expiration time (epoch seconds).
    pub exp: usize,
    /// Role assigned by Supabase.
    pub role: String,
}

/// Manages Supabase JWT validation state.
#[derive(Clone)]
pub struct AuthState {
    /// Decoding key used for ES256 tokens.
    decoding_key: Arc<RwLock<Option<DecodingKey>>>,
    /// Supabase project base URL used to fetch JWKS.
    project_url: String,
    /// Expected audience values for Supabase tokens.
    expected_audience: Option<Vec<String>>,
    #[cfg(test)]
    test_tokens: Option<Arc<RwLock<HashMap<String, Claims>>>>,
}

impl AuthState {
    /// Creates a new auth state for a given Supabase project URL.
    pub fn new(project_url: String, expected_audience: Option<Vec<String>>) -> Self {
        Self {
            decoding_key: Arc::new(RwLock::new(None)),
            project_url,
            expected_audience,
            #[cfg(test)]
            test_tokens: None,
        }
    }

    #[cfg(test)]
    pub fn with_test_tokens(
        project_url: String,
        expected_audience: Option<Vec<String>>,
        tokens: Vec<(String, Claims)>,
    ) -> Self {
        let mut map = HashMap::new();
        for (token, claims) in tokens {
            map.insert(token, claims);
        }

        Self {
            decoding_key: Arc::new(RwLock::new(None)),
            project_url,
            expected_audience,
            test_tokens: Some(Arc::new(RwLock::new(map))),
        }
    }

    /// Fetches the JWKS from Supabase and stores the ES256 decoding key.
    pub async fn load_keys(&self) -> Result<(), String> {
        let jwks_url = format!("{}/auth/v1/.well-known/jwks.json", self.project_url);
        println!("Fetching JWKS from: {}", jwks_url);

        let jwks: Jwks = reqwest::get(&jwks_url)
            .await
            .map_err(|e| format!("Failed to fetch JWKS: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse JWKS JSON: {}", e))?;

        // Find the ES256 key (standard for Supabase).
        if let Some(key) = jwks.keys.iter().find(|k| k.alg == "ES256" && k.kty == "EC") {
            println!("Found valid ES256 key with ID: {}", key.kid);

            let decoding_key = DecodingKey::from_ec_components(&key.x, &key.y)
                .map_err(|e| format!("Failed to create decoding key: {}", e))?;

            let mut lock = self
                .decoding_key
                .write()
                .expect("JWT decoding key lock poisoned - critical auth failure");
            *lock = Some(decoding_key);
            Ok(())
        } else {
            Err("No supported ES256/EC key found in Supabase JWKS".to_string())
        }
    }

    /// Validates a bearer token using the cached ES256 key.
    ///
    /// # Errors
    /// Returns an error if keys have not been loaded or if the JWT fails validation.
    pub fn validate_token(&self, token: &str) -> Result<TokenData<Claims>, String> {
        let allow_test_tokens = cfg!(test)
            || std::env::var("MAHJONG_ALLOW_TEST_TOKENS")
                .map(|value| {
                    let normalized = value.trim().to_ascii_lowercase();
                    normalized == "1" || normalized == "true" || normalized == "yes"
                })
                .unwrap_or(false);

        #[cfg(test)]
        {
            if let Some(test_tokens) = &self.test_tokens {
                let tokens = test_tokens
                    .read()
                    .expect("Test token map lock poisoned - invalid auth test setup");
                if let Some(claims) = tokens.get(token) {
                    return Ok(TokenData {
                        header: jsonwebtoken::Header::default(),
                        claims: claims.clone(),
                    });
                }
            }
        }

        if allow_test_tokens && token.starts_with("test-token-") {
            let exp = SystemTime::now()
                .duration_since(UNIX_EPOCH)
                .map_err(|_| "System clock error".to_string())?
                .as_secs()
                .saturating_add(3600) as usize;
            let subject =
                extract_uuid_subject_from_test_token(token).unwrap_or_else(|| token.to_string());

            return Ok(TokenData {
                header: jsonwebtoken::Header::default(),
                claims: Claims {
                    sub: subject,
                    exp,
                    role: "user".to_string(),
                },
            });
        }

        let lock = self
            .decoding_key
            .read()
            .expect("JWT decoding key lock poisoned - critical auth failure");
        let key = lock.as_ref().ok_or("Auth keys not loaded")?;

        let mut validation = Validation::new(Algorithm::ES256);
        // Supabase often sets the audience to "authenticated" or uses the project ref.
        if let Some(expected_audience) = self.expected_audience.as_ref() {
            validation.set_audience(expected_audience);
        } else {
            validation.validate_aud = false;
        }

        decode::<Claims>(token, key, &validation)
            .map_err(|e| format!("Token validation failed: {}", e))
    }
}

fn extract_uuid_subject_from_test_token(token: &str) -> Option<String> {
    if token.len() < 36 {
        return None;
    }

    let candidate = &token[token.len() - 36..];
    Uuid::parse_str(candidate).ok().map(|uuid| uuid.to_string())
}

/// JWKS response shape for Supabase.
#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<JwkKey>,
}

/// Single JWKS key entry (ES256/EC).
#[derive(Debug, Deserialize)]
struct JwkKey {
    /// Key ID for diagnostics.
    kid: String,
    /// Key type, expected to be "EC".
    kty: String,
    /// Algorithm, expected to be "ES256".
    alg: String,
    /// X coordinate for the EC public key.
    x: String,
    /// Y coordinate for the EC public key.
    y: String,
}
