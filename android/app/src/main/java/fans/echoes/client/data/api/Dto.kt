package fans.echoes.client.data.api

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Mirrors the `Story` type the web API returns (camelCase JSON). */
@Serializable
data class Story(
    val id: String,
    val title: String,
    val description: String = "",
    val category: String = "Other",
    val audioBlobUrl: String = "",
    val durationSeconds: Int = 0,
    val publishGate: String = "evaluate",
    val createdAt: Long = 0,
    val status: String = "draft",
    val ownerId: String? = null,
    val authorWallet: String? = null,
    val coverImageUrl: String? = null,
    val authorTwitter: String? = null,
    /** Signature of the on-chain listing payment, when the fee route was used. */
    val listingTxSig: String? = null,
    val ticker: String? = null,
    val tokenMint: String? = null,
    val tokenListingUrl: String? = null,
    val launchType: String? = null,
    val sponsorWallet: String? = null,
    val arweaveCid: String? = null,
    val isPrivate: Boolean = false,
    val priceSol: Double? = null,
) {
    val isTokenized: Boolean get() = status == "tokenized"
}

@Serializable
data class PublicProfile(
    val wallet: String,
    val age: Int? = null,
    val country: String? = null,
    val languages: String? = null,
)

@Serializable
data class PoolEntry(
    val storyId: String,
    val title: String = "",
    val category: String = "",
    val durationSeconds: Int = 0,
    val authorWallet: String = "",
    val commitCount: Int = 0,
    val revealCount: Int = 0,
    val totalEchoesWeight: Double = 0.0,
    val rank: Int = 0,
)

@Serializable
data class PoolState(
    val poolId: Int,
    val phase: String,
    val voteCloseAt: Long,
    val revealCloseAt: Long,
    val echoesVoteCost: Double = 0.0,
    val solPrize: Double = 0.0,
    val totalVotes: Int = 0,
    val entries: List<PoolEntry> = emptyList(),
    val finalized: Boolean = false,
)

/** `POST /api/auth/challenge` — the server echoes back the message to sign. */
@Serializable
data class ChallengeRequest(
    val address: String? = null,
    /** "siws" asks for a Sign In With Solana payload instead of a server-written message. */
    val mode: String? = null,
)

@Serializable
data class ChallengeResponse(
    val message: String? = null,
    val siws: SiwsPayload? = null,
)

/** The fields a wallet turns into the standard Sign In With Solana message. */
@Serializable
data class SiwsPayload(
    val domain: String,
    val statement: String,
    val uri: String,
    val version: String = "1",
    val chainId: String = "mainnet",
    val nonce: String,
    val issuedAt: String,
    val expirationTime: String,
)

/** What this phone reports about itself when it signs in, shown in the Devices list. */
@Serializable
data class DeviceInfo(val name: String, val platform: String, val seeker: Boolean)

/**
 * `signature` is base64 of the 64-byte ed25519 signature. With Sign In With
 * Solana, `signedMessage` is base64 of the exact message the wallet signed.
 */
@Serializable
data class VerifyRequest(
    val address: String,
    val signature: String,
    val signedMessage: String? = null,
    val device: DeviceInfo? = null,
)

@Serializable
data class DeviceDto(
    val id: String,
    val name: String,
    val platform: String? = null,
    val seeker: Boolean = false,
    val createdAt: String = "",
    val lastSeenAt: String = "",
    val current: Boolean = false,
)

@Serializable
data class DevicesResponse(val available: Boolean = false, val devices: List<DeviceDto> = emptyList())

@Serializable
data class SeekerStatus(
    val available: Boolean = true,
    val verified: Boolean = false,
    val reason: String? = null,
)

@Serializable
data class AuthState(
    val authenticated: Boolean = false,
    val address: String? = null,
)

@Serializable
data class ReferralResponse(
    val code: String? = null,
    val count: Int = 0,
    val referredBy: String? = null,
    val referralSplit: Double = 0.5,
)

@Serializable
data class EvaluationCriteria(
    val audioQuality: Int,
    val storytelling: Int,
    val descriptionAccuracy: Int,
)

@Serializable
data class Evaluation(
    val storyId: String,
    val criteria: EvaluationCriteria,
    val listenedPercent: Double,
)

@Serializable
data class EvaluationRequest(val evaluation: Evaluation, val evaluatorWallet: String)

@Serializable
data class FavouriteRequest(val storyId: String, val wallet: String)

@Serializable
data class FavouriteResponse(val isFav: Boolean = false)

/** The caller's own profile. Every field except the wallet is optional. */
@Serializable
data class UserProfile(
    val wallet: String,
    val age: Int? = null,
    val gender: String? = null,
    val status: String? = null,
    val country: String? = null,
    val languages: String? = null,
    val goals: String? = null,
    val email: String? = null,
    val twitter: String? = null,
    val referralCode: String? = null,
    val referredBy: String? = null,
    val referralSplit: Double? = null,
)

@Serializable
data class VoteRequest(
    val voter: String,
    val commitment: String,
    val echoesAmount: Double,
)

@Serializable
data class RevealRequest(val voter: String, val storyId: String, val salt: String)

/** `GET /api/unlock/tx` returns unsigned, base64-encoded transactions to sign. */
@Serializable
data class UnlockTxResponse(val transactions: List<String> = emptyList())

/** `GET /api/listing/tx` — unsigned $ECHOES listing payment built by the server. */
@Serializable
data class ListingTxResponse(
    val transactions: List<String> = emptyList(),
    val feeEchoes: Int = 0,
)

@Serializable
data class UnlockRequest(val storyId: String, val wallet: String, val txSig: String)

/** The server requires an explicit confirmation string before erasing an account. */
@Serializable
data class DeleteAccountRequest(val confirm: String = "DELETE")

@Serializable
data class ReportRequest(val storyId: String, val reason: String, val details: String? = null)

@Serializable
data class ApiError(val error: String? = null)
