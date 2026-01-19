//! Admin authorization utilities for role-based access control.
//!
//! This module provides role extraction from JWT tokens and authorization
//! helpers for admin endpoints. All admin actions require elevated privileges
//! beyond regular user access.
//!
//! # Role Hierarchy
//!
//! - **User**: Standard player (default role)
//! - **Moderator**: Can force-forfeit, force-pause/resume, view health metrics
//! - **Admin**: All moderator actions + list all rooms
//! - **SuperAdmin**: Reserved for future elevated privileges
//!
//! # Example
//!
//! ```ignore
//! use mahjong_server::authorization::{require_admin_role, Role};
//! use axum::http::HeaderMap;
//!
//! async fn admin_endpoint(headers: HeaderMap, auth_state: Arc<AuthState>) {
//!     let admin_ctx = require_admin_role(&headers, &auth_state)?;
//!     // admin_ctx.role is at least Moderator
//!     // admin_ctx.user_id and display_name available for audit logging
//! }
//! ```

use crate::auth::{AuthState, Claims};
use axum::http::{HeaderMap, StatusCode};
use std::str::FromStr;

/// User role levels for authorization.
///
/// Roles are extracted from the JWT `claims.role` field set by Supabase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Role {
    /// Standard user role (no admin privileges).
    User,
    /// Moderator role (can manage games and view metrics).
    Moderator,
    /// Admin role (all moderator actions + room management).
    Admin,
    /// Super admin role (reserved for future elevated privileges).
    SuperAdmin,
}

impl FromStr for Role {
    type Err = String;

    /// Parse a role string from JWT claims.
    ///
    /// # Arguments
    ///
    /// * `role_str` - The role string from `claims.role`
    ///
    /// # Returns
    ///
    /// - `Ok(Role)` if the string matches a known admin role
    /// - `Err(String)` if the role is unknown or insufficient
    fn from_str(role_str: &str) -> Result<Self, Self::Err> {
        match role_str {
            "moderator" => Ok(Role::Moderator),
            "admin" => Ok(Role::Admin),
            "super_admin" => Ok(Role::SuperAdmin),
            "user" => Ok(Role::User),
            _ => Err(format!("Unknown role: {}", role_str)),
        }
    }
}

impl Role {
    /// Check if this role has at least moderator privileges.
    pub fn is_moderator_or_higher(&self) -> bool {
        matches!(self, Role::Moderator | Role::Admin | Role::SuperAdmin)
    }

    /// Check if this role has at least admin privileges.
    pub fn is_admin_or_higher(&self) -> bool {
        matches!(self, Role::Admin | Role::SuperAdmin)
    }
}

/// Context extracted from a validated admin JWT token.
///
/// Contains user identification and role information for audit logging
/// and authorization checks.
#[derive(Debug, Clone)]
pub struct AdminContext {
    /// User ID from JWT sub claim.
    pub user_id: String,
    /// Role level extracted from JWT.
    pub role: Role,
    /// Display name for audit events (uses user_id if no separate name).
    pub display_name: String,
}

/// Extracts and validates admin credentials from HTTP headers.
///
/// # Arguments
///
/// * `headers` - HTTP request headers containing Authorization bearer token
/// * `auth_state` - Shared authentication state with JWT decoding keys
///
/// # Returns
///
/// - `Ok(AdminContext)` if token is valid and role is moderator or higher
/// - `Err((StatusCode, String))` with appropriate HTTP error code
///
/// # Errors
///
/// - `401 Unauthorized` - Missing or invalid JWT token
/// - `403 Forbidden` - Valid token but insufficient role (user or unknown)
///
/// # Example
///
/// ```ignore
/// let admin_ctx = require_admin_role(&headers, &state.auth)?;
/// if admin_ctx.role.is_admin_or_higher() {
///     // Admin-only action
/// }
/// ```
pub fn require_admin_role(
    headers: &HeaderMap,
    auth_state: &AuthState,
) -> Result<AdminContext, (StatusCode, String)> {
    // Extract Authorization header
    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .ok_or((
            StatusCode::UNAUTHORIZED,
            "Missing Authorization header".to_string(),
        ))?;

    // Extract bearer token
    let token = auth_header.strip_prefix("Bearer ").ok_or((
        StatusCode::UNAUTHORIZED,
        "Invalid Authorization header format (expected 'Bearer <token>')".to_string(),
    ))?;

    // Validate token
    let token_data = auth_state.validate_token(token).map_err(|e| {
        (
            StatusCode::UNAUTHORIZED,
            format!("Token validation failed: {}", e),
        )
    })?;

    let claims: Claims = token_data.claims;

    // Parse role
    let role = Role::from_str(&claims.role)
        .map_err(|e| (StatusCode::FORBIDDEN, format!("Invalid role: {}", e)))?;

    // Require at least moderator role
    if !role.is_moderator_or_higher() {
        return Err((
            StatusCode::FORBIDDEN,
            format!(
                "Forbidden: Admin role required (current role: {})",
                claims.role
            ),
        ));
    }

    // Build admin context
    Ok(AdminContext {
        user_id: claims.sub.clone(),
        display_name: claims.sub, // Use user_id as display name for now
        role,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_role_from_str() {
        assert_eq!(Role::from_str("user").unwrap(), Role::User);
        assert_eq!(Role::from_str("moderator").unwrap(), Role::Moderator);
        assert_eq!(Role::from_str("admin").unwrap(), Role::Admin);
        assert_eq!(Role::from_str("super_admin").unwrap(), Role::SuperAdmin);
        assert!(Role::from_str("unknown").is_err());
    }

    #[test]
    fn test_role_hierarchy() {
        assert!(!Role::User.is_moderator_or_higher());
        assert!(Role::Moderator.is_moderator_or_higher());
        assert!(Role::Admin.is_moderator_or_higher());
        assert!(Role::SuperAdmin.is_moderator_or_higher());

        assert!(!Role::User.is_admin_or_higher());
        assert!(!Role::Moderator.is_admin_or_higher());
        assert!(Role::Admin.is_admin_or_higher());
        assert!(Role::SuperAdmin.is_admin_or_higher());
    }

    #[test]
    fn test_role_ordering() {
        assert!(Role::User < Role::Moderator);
        assert!(Role::Moderator < Role::Admin);
        assert!(Role::Admin < Role::SuperAdmin);
    }
}
