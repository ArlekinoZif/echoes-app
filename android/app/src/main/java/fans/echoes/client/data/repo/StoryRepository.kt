package fans.echoes.client.data.repo

import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.Story
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.util.UUID

/** Publishing a story: upload the audio, then create the record. */
object StoryRepository {

    private const val AUDIO_TYPE = "audio/mp4"

    suspend fun uploadAudio(file: File): String {
        val body = file.asRequestBody(AUDIO_TYPE.toMediaType())
        return Api.service.upload(
            filename = file.name,
            contentType = AUDIO_TYPE,
            body = body,
        ).url
    }

    suspend fun uploadImage(bytes: ByteArray, filename: String, contentType: String): String {
        val body = bytes.toRequestBody(contentType.toMediaType())
        return Api.service.upload(filename = filename, contentType = contentType, body = body).url
    }

    /**
     * Creates the story under the community-review gate. Publishing straight to
     * "listed" requires a verified on-chain payment, which belongs to the
     * payments release.
     */
    suspend fun publish(
        ownerId: String,
        title: String,
        description: String,
        category: String,
        audioUrl: String,
        durationSeconds: Int,
        coverImageUrl: String?,
        /** Set when the listing fee was paid; the story then publishes at once. */
        listingTxSig: String? = null,
    ): Story {
        val paid = listingTxSig != null
        val story = Story(
            id = UUID.randomUUID().toString(),
            title = title.trim(),
            description = description.trim(),
            category = category,
            audioBlobUrl = audioUrl,
            durationSeconds = durationSeconds,
            publishGate = if (paid) "pay" else "evaluate",
            createdAt = System.currentTimeMillis(),
            status = if (paid) "listed" else "pending_eval",
            ownerId = ownerId,
            authorWallet = ownerId,
            coverImageUrl = coverImageUrl,
            listingTxSig = listingTxSig,
        )
        Api.service.createStory(story)
        return story
    }

    /** Server errors arrive as `{"error": "..."}`; surface that text, not a code. */
    fun serverMessage(body: String?): String? = runCatching {
        val json = Json { ignoreUnknownKeys = true }
        (json.parseToJsonElement(body ?: return null) as? JsonObject)
            ?.get("error")?.toString()?.trim('"')
    }.getOrNull()
}
