# SAML 2.0 & Enterprise Single Sign-On (SSO) Adapter

## Overview
ProofPay provides a standards-compliant SAML 2.0 Identity Provider (IdP) integration layer designed for enterprise customer procurement. This enables Fortune 500 treasury, procurement, and risk audit teams to authenticate via their existing corporate directory providers (Okta, Microsoft Azure AD / Entra ID, Google Workspace, Ping Identity).

## Architecture & Security Controls

- **Replay Protection**: Cryptographic nonce tracking stores consumed SAML Assertion IDs with automatic TTL expiration to prevent assertion interception and replay attacks.
- **Clock-Skew Tolerance**: Configurable grace periods (default 60 seconds) allow for minor drift between enterprise IdP clocks and ProofPay cloud nodes during `NotBefore` and `NotOnOrAfter` window evaluations.
- **Audience Enforcement**: Strict validation ensures assertions targeted for other services cannot be forwarded to ProofPay.
- **Just-In-Time (JIT) Provisioning**: Extracts standardized attributes (`email`, `firstName`, `lastName`, `organization`, and `roles`) to automatically assign organization-level permissions and audit logging context.

## Identity Provider Configuration Reference

| Parameter | Description | Example |
|---|---|---|
| `entityId` | ProofPay SP Entity ID / Audience | `https://proofpay.io/saml/metadata` |
| `acsUrl` | Assertion Consumer Service URL | `https://proofpay.io/api/v1/auth/saml/callback` |
| `nameIdFormat` | User principal format | `urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress` |
| `binding` | Protocol Binding | `HTTP-POST` |
