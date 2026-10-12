package fans.echoes.client.data.api

import fans.echoes.client.BuildConfig
import kotlinx.serialization.Serializable

/** Single source of truth for where the backend lives. */
object ApiConfig {
    /** Always ends with a slash so Retrofit resolves relative paths correctly. */
    val baseUrl: String = BuildConfig.API_URL.trimEnd('/') + "/"
    val host: String = baseUrl.toHttpHost()

    private fun String.toHttpHost(): String =
        substringAfter("://").substringBefore('/').substringBefore(':')
}

@Serializable
data class UploadResponse(val url: String, val key: String? = null)
