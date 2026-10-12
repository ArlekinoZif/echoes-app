package fans.echoes.client.data.repo

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.PoolState
import fans.echoes.client.data.api.RevealRequest
import fans.echoes.client.data.api.VoteRequest
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * Weekly pool voting.
 *
 * Votes are blind: the client sends only `sha256(storyId + voter + salt)` during
 * the voting window and discloses the story and salt in the reveal window. The
 * salt therefore has to survive on the device — losing it means the vote can
 * never be revealed — so it is kept in encrypted storage.
 */
object PoolRepository {

    private const val PREFS = "echoes-pool"

    private lateinit var prefs: android.content.SharedPreferences

    fun init(context: Context) {
        if (::prefs.isInitialized) return
        prefs = runCatching {
            EncryptedSharedPreferences.create(
                context,
                PREFS,
                MasterKey.Builder(context).setKeyScheme(MasterKey.KeyScheme.AES256_GCM).build(),
                EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
                EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
            )
        }.getOrElse { context.getSharedPreferences("$PREFS-plain", Context.MODE_PRIVATE) }
    }

    suspend fun pool(): PoolState = Api.service.pool()

    fun commitment(storyId: String, voter: String, salt: String): String =
        MessageDigest.getInstance("SHA-256")
            .digest((storyId + voter + salt).toByteArray())
            .joinToString("") { "%02x".format(it) }

    private fun key(poolId: Int, voter: String) = "$poolId|$voter"

    fun storedVote(poolId: Int, voter: String): Pair<String, String>? {
        val raw = prefs.getString(key(poolId, voter), null) ?: return null
        val parts = raw.split("|", limit = 2)
        return if (parts.size == 2) parts[0] to parts[1] else null
    }

    suspend fun vote(poolId: Int, voter: String, storyId: String, echoesAmount: Double) {
        val salt = ByteArray(16).also { SecureRandom().nextBytes(it) }
            .joinToString("") { "%02x".format(it) }
        val commitment = commitment(storyId, voter, salt)

        // Store before sending: a vote the server accepted but whose salt was lost
        // could never be revealed.
        prefs.edit().putString(key(poolId, voter), "$storyId|$salt").apply()
        runCatching {
            Api.service.vote(VoteRequest(voter = voter, commitment = commitment, echoesAmount = echoesAmount))
        }.onFailure {
            prefs.edit().remove(key(poolId, voter)).apply()
            throw it
        }
    }

    suspend fun reveal(poolId: Int, voter: String) {
        val (storyId, salt) = storedVote(poolId, voter)
            ?: error("No vote from this device to reveal")
        Api.service.reveal(RevealRequest(voter = voter, storyId = storyId, salt = salt))
    }
}
