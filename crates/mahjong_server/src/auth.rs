use jsonwebtoken::{decode, Algorithm, DecodingKey, TokenData, Validation};
use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // The user ID
    pub exp: usize,  // Expiration time
    pub role: String,
}

#[derive(Clone)]
pub struct AuthState {
    // We store the specific decoding key needed for Supabase's ES256 signature
    decoding_key: Arc<RwLock<Option<DecodingKey>>>,
    project_url: String,
}

impl AuthState {
    pub fn new(project_url: String) -> Self {
        Self {
            decoding_key: Arc::new(RwLock::new(None)),
            project_url,
        }
    }

    /// Fetches the JWKS (JSON Web Key Set) from Supabase and parses the ES256 key
    pub async fn load_keys(&self) -> Result<(), String> {
        let jwks_url = format!("{}/auth/v1/.well-known/jwks.json", self.project_url);
        println!("Fetching JWKS from: {}", jwks_url);

        let jwks: Jwks = reqwest::get(&jwks_url)
            .await
            .map_err(|e| format!("Failed to fetch JWKS: {}", e))?
            .json()
            .await
            .map_err(|e| format!("Failed to parse JWKS JSON: {}", e))?;

        // Find the ES256 key (usually the standard for Supabase now)
        if let Some(key) = jwks.keys.iter().find(|k| k.alg == "ES256" && k.kty == "EC") {
            println!("Found valid ES256 key with ID: {}", key.kid);

            let decoding_key = DecodingKey::from_ec_components(&key.x, &key.y)
                .map_err(|e| format!("Failed to create decoding key: {}", e))?;

            let mut lock = self.decoding_key.write().unwrap();
            *lock = Some(decoding_key);
            Ok(())
        } else {
            Err("No supported ES256/EC key found in Supabase JWKS".to_string())
        }
    }

    pub fn validate_token(&self, token: &str) -> Result<TokenData<Claims>, String> {
        let lock = self.decoding_key.read().unwrap();
        let key = lock.as_ref().ok_or("Auth keys not loaded")?;

        let mut validation = Validation::new(Algorithm::ES256);
        // Supabase often sets the audience to 'authenticated' or uses the project ref.
        // For now, we might need to disable audience check or configure it strictly if we know it.
        validation.validate_aud = false;

        decode::<Claims>(token, key, &validation)
            .map_err(|e| format!("Token validation failed: {}", e))
    }
}

// Internal structures for parsing the JWKS JSON
#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<JwkKey>,
}

#[derive(Debug, Deserialize)]
struct JwkKey {
    kid: String,
    kty: String, // Should be "EC"
    alg: String, // Should be "ES256"
    x: String,
    y: String,
}
