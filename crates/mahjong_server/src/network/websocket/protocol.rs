use crate::network::messages::Envelope;

/// Parse a raw websocket text payload into an [`Envelope`].
pub fn parse_incoming_envelope(raw_text: &str) -> Result<Envelope, String> {
    Envelope::from_json(raw_text).map_err(|e| e.to_string())
}
