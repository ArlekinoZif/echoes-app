package fans.echoes.client.data.api

import okhttp3.RequestBody
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.HTTP
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

/** The Echoes web API, consumed directly — no page is loaded by this client. */
interface EchoesApi {

    @GET("api/stories")
    suspend fun stories(@Query("type") type: String = "public"): List<Story>

    @GET("api/stories")
    suspend fun storiesForWallet(
        @Query("type") type: String,
        @Query("wallet") wallet: String,
    ): List<Story>

    @GET("api/stories/{id}")
    suspend fun story(@Path("id") id: String): Story

    @GET("api/profiles")
    suspend fun profiles(@Query("wallets") wallets: String): List<PublicProfile>

    @GET("api/pool")
    suspend fun pool(): PoolState

    @GET("api/referral")
    suspend fun referral(@Query("wallet") wallet: String): ReferralResponse

    // ── Session ───────────────────────────────────────────────────────────────

    @POST("api/auth/challenge")
    suspend fun challenge(@Body body: ChallengeRequest): ChallengeResponse

    @POST("api/auth/verify")
    suspend fun verify(@Body body: VerifyRequest): AuthState

    @GET("api/auth/session")
    suspend fun session(): AuthState

    @POST("api/auth/logout")
    suspend fun logout(): Response<Unit>

    @GET("api/auth/devices")
    suspend fun devices(): DevicesResponse

    @DELETE("api/auth/devices/{id}")
    suspend fun removeDevice(@Path("id") id: String): Response<Unit>

    // ── Seeker ────────────────────────────────────────────────────────────────

    @GET("api/seeker/verify")
    suspend fun seekerStatus(): SeekerStatus

    @POST("api/seeker/verify")
    suspend fun verifySeeker(): SeekerStatus

    // ── Writes ────────────────────────────────────────────────────────────────

    @POST("api/stories")
    suspend fun createStory(@Body story: Story): Response<Unit>

    /** Story ids this account has already evaluated. */
    @GET("api/evaluations")
    suspend fun myEvaluatedIds(): List<String>

    @POST("api/evaluations")
    suspend fun submitEvaluation(@Body body: EvaluationRequest): Response<Unit>

    @GET("api/favourites")
    suspend fun favourites(): List<String>

    @POST("api/favourites")
    suspend fun toggleFavourite(@Body body: FavouriteRequest): FavouriteResponse

    @GET("api/profile")
    suspend fun profile(): UserProfile?

    @POST("api/profile")
    suspend fun saveProfile(@Body profile: UserProfile): Response<Unit>

    @GET("api/listing/tx")
    suspend fun listingTransaction(@Query("wallet") wallet: String): ListingTxResponse

    @GET("api/unlock/tx")
    suspend fun unlockTransaction(
        @Query("storyId") storyId: String,
        @Query("buyer") buyer: String,
    ): UnlockTxResponse

    @POST("api/unlock")
    suspend fun confirmUnlock(@Body body: UnlockRequest): Response<Unit>

    @POST("api/pool/vote")
    suspend fun vote(@Body body: VoteRequest): Response<Unit>

    @POST("api/pool/reveal")
    suspend fun reveal(@Body body: RevealRequest): Response<Unit>

    @POST("api/reports")
    suspend fun report(@Body body: ReportRequest): Response<Unit>

    @HTTP(method = "DELETE", path = "api/account", hasBody = true)
    suspend fun deleteAccount(@Body body: DeleteAccountRequest): Response<Unit>

    /**
     * Raw upload: the server reads the body as bytes and takes the file name and
     * type from headers.
     */
    @POST("api/upload")
    suspend fun upload(
        @Header("x-filename") filename: String,
        @Header("x-content-type") contentType: String,
        @Body body: RequestBody,
    ): UploadResponse
}
