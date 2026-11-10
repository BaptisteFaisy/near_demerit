//! NEP-171 read side, NEP-181 enumeration, and a title computed at read time.
//! A licence never changes hands, so the transfer methods only refuse.

use near_sdk::serde::{Deserialize, Serialize};
use near_sdk::AccountId;

use crate::model::*;
use crate::rules;
use crate::state::now;
use crate::Permis;

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct NftMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct TokenMetadata {
    pub title: Option<String>,
    pub description: Option<String>,
    pub media: Option<String>,
    pub media_hash: Option<String>,
    pub copies: Option<u64>,
    pub issued_at: Option<String>,
    pub expires_at: Option<String>,
    pub starts_at: Option<String>,
    pub updated_at: Option<String>,
    pub extra: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
#[serde(crate = "near_sdk::serde")]
pub struct NftToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub metadata: TokenMetadata,
    /// The same state as text, so a wallet shows it without a dedicated page.
    pub computed_title: String,
}

pub fn metadata() -> NftMetadata {
    NftMetadata {
        spec: "nft-1.0.0".to_string(),
        name: "Permis à points".to_string(),
        symbol: "PERMIS".to_string(),
        icon: None,
        base_uri: None,
        reference: None,
        reference_hash: None,
    }
}

impl Permis {
    pub fn token_of(&self, token_id: &str) -> NftToken {
        let license = self
            .tokens
            .get(&token_id.to_string())
            .expect("ERR_TOKEN_NOT_FOUND");
        let view = self.status_of(&license.holder, &license.category);
        let title = computed_title(&license.category, view.points, view.cap, &view.status);
        let extra = near_sdk::serde_json::json!({
            "points": view.points,
            "cap": view.cap,
            "status": view.status,
            "coefficient": view.coefficient,
            "bond": view.bond.to_string(),
            "required_bond": view.required_bond.to_string(),
            "invalidations": view.invalidations,
            "missions_ok": view.missions_ok,
            "next_regen_at": view.next_regen_at,
            "category": license.category,
        })
        .to_string();
        NftToken {
            token_id: license.token_id.clone(),
            owner_id: license.holder.clone(),
            metadata: TokenMetadata {
                title: Some(title.clone()),
                description: Some(
                    "Non-transferable professional licence: points you can lose, a bond that pays the client.".to_string(),
                ),
                media: None,
                media_hash: None,
                copies: Some(1),
                issued_at: Some(license.issued_at.to_string()),
                expires_at: None,
                starts_at: None,
                updated_at: Some(now().to_string()),
                extra: Some(extra),
                reference: None,
                reference_hash: None,
            },
            computed_title: title,
        }
    }

    pub fn tokens_page(&self, from_index: u64, limit: u64) -> Vec<NftToken> {
        self.tokens
            .keys()
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|id| self.token_of(&id))
            .collect()
    }

    pub fn tokens_of_owner(
        &self,
        account: &AccountId,
        from_index: u64,
        limit: u64,
    ) -> Vec<NftToken> {
        self.owned
            .get(account)
            .unwrap_or_default()
            .into_iter()
            .skip(from_index as usize)
            .take(limit as usize)
            .map(|id| self.token_of(&id))
            .collect()
    }
}

/// "Coursier · 9/12 · valide"
pub fn computed_title(category: &str, points: u8, cap: u8, status: &Status) -> String {
    let mut chars = category.chars();
    let label = match chars.next() {
        Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
        None => String::new(),
    };
    format!("{} · {}/{} · {}", label, points, cap, status_word(status))
}

pub fn status_word(status: &Status) -> &'static str {
    match status {
        Status::Probation => "probatoire",
        Status::Active => "valide",
        Status::Suspended => "suspendu",
        Status::Revoked => "révoqué",
        Status::Renounced => "rendu",
    }
}

/// The bond and the coefficient, as a wallet would display them.
pub fn bond_line(_rules: &Rules, bond: u128, coefficient: BasisPoints) -> String {
    let required = rules::required_bond(bond.max(1), coefficient);
    format!("{}/{}", bond, required)
}
