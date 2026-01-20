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
use std::sync::{Arc, RwLock};

/// Claims carried by Supabase access tokens.
#[derive(Debug, Serialize, Deserialize)]
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
}

impl AuthState {
    /// Creates a new auth state for a given Supabase project URL.
    pub fn new(project_url: String, expected_audience: Option<Vec<String>>) -> Self {
        Self {
            decoding_key: Arc::new(RwLock::new(None)),
            project_url,
            expected_audience,
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
