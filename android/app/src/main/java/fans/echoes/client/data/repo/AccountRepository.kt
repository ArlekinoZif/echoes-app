package fans.echoes.client.data.repo

import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.DeleteAccountRequest
import fans.echoes.client.data.api.ReportRequest
import fans.echoes.client.data.api.Evaluation
import fans.echoes.client.data.api.EvaluationCriteria
import fans.echoes.client.data.api.EvaluationRequest
import fans.echoes.client.data.api.FavouriteRequest
import fans.echoes.client.data.api.ReferralResponse
import fans.echoes.client.data.api.UserProfile

/** Everything tied to the signed-in account: profile, referrals, favourites, evaluations. */
object AccountRepository {

    suspend fun profile(): UserProfile? = runCatching { Api.service.profile() }.getOrNull()

    suspend fun saveProfile(profile: UserProfile) {
        Api.service.saveProfile(profile)
    }

    /** The app devices signed in to this account; empty when the server cannot list them yet. */
    suspend fun devices(): fans.echoes.client.data.api.DevicesResponse = Api.service.devices()

    suspend fun removeDevice(id: String) {
        val response = Api.service.removeDevice(id)
        if (!response.isSuccessful) throw retrofit2.HttpException(response)
    }

    suspend fun seekerStatus(): fans.echoes.client.data.api.SeekerStatus =
        runCatching { Api.service.seekerStatus() }.getOrDefault(fans.echoes.client.data.api.SeekerStatus(available = false))

    suspend fun verifySeeker(): fans.echoes.client.data.api.SeekerStatus = Api.service.verifySeeker()

    suspend fun referral(wallet: String): ReferralResponse =
        runCatching { Api.service.referral(wallet) }.getOrElse { ReferralResponse() }

    suspend fun favourites(): Set<String> =
        runCatching { Api.service.favourites().toSet() }.getOrElse { emptySet() }

    /** Returns the new favourite state for the story. */
    suspend fun toggleFavourite(storyId: String, wallet: String): Boolean =
        Api.service.toggleFavourite(FavouriteRequest(storyId = storyId, wallet = wallet)).isFav

    /** Content report, required by the store policy for user-generated media. */
    suspend fun report(storyId: String, reason: String, details: String?) {
        Api.service.report(
            ReportRequest(storyId = storyId, reason = reason, details = details?.takeIf { it.isNotBlank() }),
        )
    }

    /**
     * Erases the account and everything tied to it. The session dies with it, so
     * the caller must return to the signed-out state afterwards.
     */
    suspend fun deleteAccount() {
        Api.service.deleteAccount(DeleteAccountRequest())
        Api.cookieJar.clear()
    }

    suspend fun evaluatedStoryIds(): Set<String> =
        runCatching { Api.service.myEvaluatedIds().toSet() }.getOrElse { emptySet() }

    /**
     * Community review. `listenedPercent` is how much of the recording the
     * evaluator actually heard, which the server stores alongside the scores.
     */
    suspend fun submitEvaluation(
        storyId: String,
        wallet: String,
        audioQuality: Int,
        storytelling: Int,
        descriptionAccuracy: Int,
        listenedPercent: Double,
    ) {
        Api.service.submitEvaluation(
            EvaluationRequest(
                evaluation = Evaluation(
                    storyId = storyId,
                    criteria = EvaluationCriteria(
                        audioQuality = audioQuality.coerceIn(1, 5),
                        storytelling = storytelling.coerceIn(1, 5),
                        descriptionAccuracy = descriptionAccuracy.coerceIn(1, 5),
                    ),
                    listenedPercent = listenedPercent.coerceIn(0.0, 100.0),
                ),
                evaluatorWallet = wallet,
            ),
        )
    }
}
