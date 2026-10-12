package fans.echoes.client.data.api

import android.content.Context
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import java.util.concurrent.TimeUnit

/**
 * Process-wide API access. Everything the app reads or writes goes through here,
 * so there is exactly one cookie jar and one HTTP client.
 */
object Api {

    private lateinit var appContext: Context

    val json: Json by lazy {
        Json {
            ignoreUnknownKeys = true
            explicitNulls = false
            coerceInputValues = true
            // The API validates every field it requires, so a value that happens
            // to equal a Kotlin default must still be sent. Without this, a story
            // with publishGate "evaluate" is posted without that field at all and
            // the server rejects it.
            encodeDefaults = true
        }
    }

    val cookieJar: SessionCookieJar by lazy { SessionCookieJar(appContext) }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .cookieJar(cookieJar)
            .connectTimeout(15, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(120, TimeUnit.SECONDS) // audio uploads
            .retryOnConnectionFailure(true)
            .build()
    }

    val service: EchoesApi by lazy {
        Retrofit.Builder()
            .baseUrl(ApiConfig.baseUrl)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()
            .create(EchoesApi::class.java)
    }

    /** Shared with Coil so images reuse the same connection pool. */
    val httpClient: OkHttpClient get() = client

    fun init(context: Context) {
        appContext = context.applicationContext
    }
}

/** Message an API failure can show to a person without leaking internals. */
fun Throwable.userMessage(): String = when (this) {
    is retrofit2.HttpException -> when (code()) {
        401 -> "Please sign in again."
        403 -> "You do not have access to this."
        404 -> "Not found."
        in 500..599 -> "The service is having trouble. Try again shortly."
        else -> "Request failed (${code()})."
    }
    is java.net.UnknownHostException, is java.net.ConnectException ->
        "No internet connection. Check your network and try again."
    is java.net.SocketTimeoutException -> "The connection timed out."
    else -> message ?: "Something went wrong."
}
