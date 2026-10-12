package fans.echoes.client.data

import android.net.Uri
import fans.echoes.client.BuildConfig
import fans.echoes.client.data.api.Story
import java.text.Normalizer

/**
 * Public recording links, in the same shape the website uses
 * (`app/src/lib/story-url.ts`): `/recordings/<slug>-<id>`. The slug is
 * decoration; the trailing UUID is the key. Keeping the two in step means a
 * link shared from the app opens the website's page for people without the
 * app, and a link shared from the website opens the app for people with it.
 */
object StoryLinks {

    private val uuidSuffix = Regex(
        "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$",
        RegexOption.IGNORE_CASE,
    )

    /** Only published stories have a public page. */
    fun isShareable(story: Story): Boolean =
        story.status == "listed" || story.status == "tokenized"

    fun url(story: Story): String {
        val slug = slugify(story.title)
        val segment = if (slug.isEmpty()) story.id else "$slug-${story.id}"
        return "${BuildConfig.SITE_URL.trimEnd('/')}/recordings/$segment"
    }

    /** The story id in an incoming `https://app.echoes.fans/recordings/...` link, if any. */
    fun storyId(uri: Uri?): String? {
        if (uri == null || uri.scheme != "https") return null
        if (uri.host != Uri.parse(BuildConfig.SITE_URL).host) return null
        val segments = uri.pathSegments
        if (segments.size != 2 || segments[0] != "recordings") return null
        return uuidSuffix.find(segments[1])?.value?.lowercase()
    }

    private fun slugify(title: String): String =
        Normalizer.normalize(title.lowercase(), Normalizer.Form.NFKD)
            .replace(Regex("[\\u0300-\\u036f]"), "")
            .replace(Regex("[^a-z0-9]+"), "-")
            .trim('-')
            .take(60)
}
