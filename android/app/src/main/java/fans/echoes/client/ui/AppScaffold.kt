package fans.echoes.client.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Mic
import androidx.compose.material.icons.filled.HowToVote
import androidx.compose.material.icons.filled.Person
import androidx.compose.material.icons.automirrored.filled.LibraryBooks
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.SideEffect
import androidx.compose.animation.togetherWith
import androidx.compose.ui.unit.dp
import fans.echoes.client.ui.theme.BrandGoldDim
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import com.solana.mobilewalletadapter.clientlib.ActivityResultSender
import fans.echoes.client.data.api.Api
import fans.echoes.client.data.api.Story
import fans.echoes.client.ui.library.LibraryScreen
import fans.echoes.client.ui.legal.PrivacyScreen
import fans.echoes.client.ui.pool.PoolScreen
import fans.echoes.client.ui.profile.ProfileScreen
import fans.echoes.client.ui.record.RecordScreen
import fans.echoes.client.ui.story.StoryScreen
import fans.echoes.client.ui.theme.Backdrop
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandPanel
import fans.echoes.client.ui.theme.BrandSurface
import fans.echoes.client.ui.theme.BrandTextMuted

private enum class Tab(val label: String, val icon: ImageVector, val backdrop: Backdrop) {
    Library("Library", Icons.AutoMirrored.Filled.LibraryBooks, Backdrop.Library),
    Record("Record", Icons.Filled.Mic, Backdrop.Record),
    Vote("Vote", Icons.Filled.HowToVote, Backdrop.Vote),
    Profile("Zone", Icons.Filled.Person, Backdrop.Zone),
}

private sealed interface Destination {
    val key: String
    val depth: Int

    data object Tabs : Destination { override val key = "tabs"; override val depth = 0 }
    data object Privacy : Destination { override val key = "privacy"; override val depth = 1 }
    data class Detail(val story: Story) : Destination {
        override val key get() = "story:${story.id}"
        override val depth = 1
    }
}

/** Top-level navigation. A selected story takes over the whole surface. */
@Composable
fun AppScaffold(
    ownerId: String,
    walletSender: ActivityResultSender?,
    onSignOut: () -> Unit,
    openStoryId: String? = null,
    onStoryOpened: () -> Unit = {},
    onBackdrop: (Backdrop) -> Unit = {},
    modifier: Modifier = Modifier,
) {
    var tab by remember { mutableStateOf(Tab.Library) }
    var selected by remember { mutableStateOf<Story?>(null) }
    var libraryRefreshKey by remember { mutableStateOf(0) }
    var privacyOpen by remember { mutableStateOf(false) }

    // An incoming recording link. A link to a story that is gone or not public
    // simply leaves the person where they were.
    LaunchedEffect(openStoryId) {
        val id = openStoryId ?: return@LaunchedEffect
        runCatching { Api.service.story(id) }.onSuccess {
            privacyOpen = false
            selected = it
        }
        onStoryOpened()
    }

    SideEffect {
        onBackdrop(
            when {
                privacyOpen -> Backdrop.Zone
                selected != null -> Backdrop.Story
                else -> tab.backdrop
            },
        )
    }

    // Where the person is: a story or the privacy page over the tabs. Going
    // deeper slides the new page in from the right; going back slides it away.
    val destination: Destination = when {
        privacyOpen -> Destination.Privacy
        selected != null -> Destination.Detail(selected!!)
        else -> Destination.Tabs
    }
    androidx.compose.animation.AnimatedContent(
        targetState = destination,
        contentKey = { it.key },
        transitionSpec = {
            val forward = targetState.depth > initialState.depth
            val slide = androidx.compose.animation.core.tween<androidx.compose.ui.unit.IntOffset>(320, easing = androidx.compose.animation.core.FastOutSlowInEasing)
            val fade = androidx.compose.animation.core.tween<Float>(260)
            if (forward) {
                (androidx.compose.animation.slideInHorizontally(slide) { it / 3 } + androidx.compose.animation.fadeIn(fade)) togetherWith
                    (androidx.compose.animation.slideOutHorizontally(slide) { -it / 8 } + androidx.compose.animation.fadeOut(fade))
            } else {
                (androidx.compose.animation.slideInHorizontally(slide) { -it / 8 } + androidx.compose.animation.fadeIn(fade)) togetherWith
                    (androidx.compose.animation.slideOutHorizontally(slide) { it / 3 } + androidx.compose.animation.fadeOut(fade))
            }
        },
        label = "destination",
        modifier = modifier,
    ) { dest ->
        when (dest) {
            Destination.Privacy -> {
                BackHandler { privacyOpen = false }
                PrivacyScreen(onBack = { privacyOpen = false }, modifier = Modifier.fillMaxSize())
            }

            is Destination.Detail -> {
                BackHandler { selected = null }
                StoryScreen(
                    story = dest.story,
                    wallet = ownerId,
                    walletSender = walletSender,
                    onBack = { selected = null },
                    modifier = Modifier.fillMaxSize(),
                )
            }

            Destination.Tabs -> {
            BackHandler(enabled = tab != Tab.Library) { tab = Tab.Library }

            Scaffold(
                modifier = Modifier.fillMaxSize(),
                containerColor = androidx.compose.ui.graphics.Color.Transparent,
                bottomBar = {
                    NavigationBar(containerColor = BrandPanel, tonalElevation = 0.dp) {
                        Tab.entries.forEach { entry ->
                            NavigationBarItem(
                                selected = tab == entry,
                                onClick = { tab = entry },
                                icon = { Icon(entry.icon, contentDescription = entry.label) },
                                label = { Text(entry.label) },
                                colors = NavigationBarItemDefaults.colors(
                                    selectedIconColor = BrandGold,
                                    selectedTextColor = BrandGold,
                                    unselectedIconColor = BrandTextMuted,
                                    unselectedTextColor = BrandTextMuted,
                                    indicatorColor = BrandGoldDim,
                                ),
                            )
                        }
                    }
                },
            ) { padding ->
                // Switching tabs: a short cross-fade with a slight settle, not a cut.
                androidx.compose.animation.AnimatedContent(
                    targetState = tab,
                    transitionSpec = {
                        (androidx.compose.animation.fadeIn(androidx.compose.animation.core.tween(220, delayMillis = 60)) +
                            androidx.compose.animation.scaleIn(androidx.compose.animation.core.tween(220, delayMillis = 60), initialScale = 0.97f)) togetherWith
                            androidx.compose.animation.fadeOut(androidx.compose.animation.core.tween(90))
                    },
                    label = "tab",
                    modifier = Modifier.fillMaxSize().padding(padding),
                ) { shown ->
                    when (shown) {
                        Tab.Library -> LibraryScreen(
                            key = libraryRefreshKey,
                            onStoryClick = { selected = it },
                        )

                        Tab.Record -> RecordScreen(
                            ownerId = ownerId,
                            walletSender = walletSender,
                            // The record screen resets itself after publishing; the library
                            // only needs to reload so the new story is there when visited.
                            onPublished = { libraryRefreshKey++ },
                        )

                        Tab.Vote -> PoolScreen(voter = ownerId)

                        Tab.Profile -> ProfileScreen(
                            wallet = ownerId,
                            onSignOut = onSignOut,
                            onOpenPrivacy = { privacyOpen = true },
                        )
                    }
                }
            }
            }
        }
    }
}
