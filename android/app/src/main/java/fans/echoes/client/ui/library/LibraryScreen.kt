package fans.echoes.client.ui.library

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import coil3.compose.AsyncImage
import fans.echoes.client.data.api.Story
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandChip
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandSurface
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.HoloText
import fans.echoes.client.ui.theme.SectionLabel

@OptIn(androidx.compose.material3.ExperimentalMaterial3Api::class)
@Composable
fun LibraryScreen(
    onStoryClick: (Story) -> Unit,
    modifier: Modifier = Modifier,
    key: Int = 0,
    viewModel: LibraryViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    androidx.compose.runtime.LaunchedEffect(key) { if (key > 0) viewModel.refresh() }

    Column(modifier = modifier.fillMaxSize().padding(horizontal = fans.echoes.client.ui.theme.ScreenPadding)) {
        Spacer(Modifier.height(20.dp))
        HoloText("records library")
        SectionLabel("Record · Listen · Earn")
        Spacer(Modifier.height(14.dp))

        OutlinedTextField(
            value = state.query,
            onValueChange = viewModel::setQuery,
            placeholder = { Text("Search stories", color = BrandTextFaint) },
            singleLine = true,
            leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null, tint = BrandTextMuted) },
            shape = RoundedCornerShape(BrandRadius.pill),
            colors = fans.echoes.client.ui.theme.brandFieldColors(),
            modifier = Modifier.fillMaxWidth(),
        )

        Spacer(Modifier.height(12.dp))
        LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            items(state.categories) { category ->
                BrandChip(
                    text = category,
                    selected = category == state.category,
                    onClick = { viewModel.setCategory(category) },
                )
            }
        }

        // Pull down to reload the library.
        androidx.compose.material3.pulltorefresh.PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = { viewModel.refresh(pulled = true) },
            modifier = Modifier.fillMaxSize(),
        ) {
        when {
            state.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                CircularProgressIndicator(color = BrandGold)
            }

            state.error != null -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    Text(state.error ?: "", color = MaterialTheme.colorScheme.error)
                    TextButton(onClick = viewModel::refresh) { Text("Try again", color = BrandGold) }
                }
            }

            state.visible.isEmpty() -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                Text(
                    "No stories match. Try another search or category.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = BrandTextMuted,
                )
            }

            else -> LazyColumn(
                verticalArrangement = Arrangement.spacedBy(10.dp),
                contentPadding = androidx.compose.foundation.layout.PaddingValues(top = 14.dp, bottom = 20.dp),
                modifier = Modifier.fillMaxSize(),
            ) {
                items(state.visible, key = { it.id }) { story ->
                    StoryRow(story = story, onClick = { onStoryClick(story) })
                }
            }
        }
        }
    }
}

@Composable
private fun StoryRow(story: Story, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(BrandRadius.xxl))
            .background(fans.echoes.client.ui.theme.BrandPanel)
            .border(
                androidx.compose.foundation.BorderStroke(1.dp, BrandBorder),
                RoundedCornerShape(BrandRadius.xxl),
            )
            .clickable(onClick = onClick)
            .padding(start = 10.dp, top = 10.dp, bottom = 10.dp, end = 14.dp),
    ) {
      // A sleeve with its record peeking out, the list form of the story screen.
      Box(Modifier.size(width = 66.dp, height = 56.dp)) {
        fans.echoes.client.ui.theme.MiniVinyl(50.dp, Modifier.align(Alignment.CenterEnd))
        Box(
            Modifier.size(56.dp).clip(RoundedCornerShape(BrandRadius.md)).background(BrandSurface),
            contentAlignment = Alignment.Center,
        ) {
            fans.echoes.client.ui.theme.CoverImage(
                story.coverImageUrl,
                Modifier.fillMaxSize(),
                seed = fans.echoes.client.data.cover.CoverArt.seedOf(story.id),
                sizePx = 168,
            )
            if (story.isPrivate) {
                Box(Modifier.fillMaxSize().background(androidx.compose.ui.graphics.Color(0x99000000))) {
                    Icon(
                        Icons.Filled.Lock,
                        contentDescription = "Private",
                        tint = BrandGold,
                        modifier = Modifier.align(Alignment.Center).size(18.dp),
                    )
                }
            }
        }
      }

        Column(Modifier.weight(1f)) {
            Text(
                story.title,
                style = MaterialTheme.typography.titleMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                listOfNotNull(
                    story.category,
                    story.authorTwitter?.let { "@$it" } ?: story.authorWallet?.short(),
                    story.durationSeconds.takeIf { it > 0 }?.asDuration(),
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
        }

        if (story.isTokenized) {
            Text("◆", color = BrandGold)
        }
    }
}

private fun String.short(): String =
    if (length > 9) "${take(4)}…${takeLast(4)}" else this

private fun Int.asDuration(): String {
    val minutes = this / 60
    val seconds = this % 60
    return if (minutes > 0) "${minutes}m ${seconds}s" else "${seconds}s"
}
