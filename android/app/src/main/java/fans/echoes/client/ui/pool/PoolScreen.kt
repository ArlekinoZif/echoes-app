package fans.echoes.client.ui.pool

import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import fans.echoes.client.data.api.PoolEntry
import fans.echoes.client.data.api.PoolState
import fans.echoes.client.data.cover.CoverArt
import fans.echoes.client.ui.theme.BrandBackground
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandGoldDim
import fans.echoes.client.ui.theme.BrandGoldLight
import fans.echoes.client.ui.theme.BrandPanel
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.CoverImage
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.HoloText
import fans.echoes.client.ui.theme.ScreenPadding
import fans.echoes.client.ui.theme.SectionLabel
import kotlinx.coroutines.delay

/**
 * The weekly pool: the prize up top, where the week stands (vote → reveal →
 * results) with a live countdown, and the stories in the running as cards.
 * Pull down to refresh.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PoolScreen(
    voter: String,
    modifier: Modifier = Modifier,
    viewModel: PoolViewModel = viewModel(),
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val haptics = LocalHapticFeedback.current
    LaunchedEffect(voter) { viewModel.load(voter) }

    // Seconds, ticking, for the countdown.
    var now by remember { mutableLongStateOf(System.currentTimeMillis() / 1000) }
    LaunchedEffect(Unit) {
        while (true) {
            now = System.currentTimeMillis() / 1000
            delay(1000)
        }
    }

    Column(modifier = modifier.fillMaxSize().padding(horizontal = ScreenPadding)) {
        Spacer(Modifier.height(20.dp))
        HoloText("weekly pool")
        SectionLabel("Blind vote · Reveal · Prize")
        Spacer(Modifier.height(12.dp))

        val pool = state.pool
        PullToRefreshBox(
            isRefreshing = state.refreshing,
            onRefresh = { viewModel.refresh(voter) },
            modifier = Modifier.weight(1f),
        ) {
            when {
                state.loading -> Box(Modifier.fillMaxSize(), Alignment.Center) {
                    CircularProgressIndicator(color = BrandGold)
                }

                state.unavailable || pool == null -> LazyColumn(Modifier.fillMaxSize()) {
                    item {
                        Text(
                            state.error ?: "Weekly voting is not open yet. Published stories enter the pool automatically.",
                            style = MaterialTheme.typography.bodyMedium,
                            color = BrandTextMuted,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth().padding(top = 60.dp),
                        )
                    }
                }

                else -> LazyColumn(
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                    contentPadding = PaddingValues(bottom = 16.dp),
                    modifier = Modifier.fillMaxSize(),
                ) {
                    item { PoolHero(pool, now, votedFor = pool.entries.firstOrNull { it.storyId == state.votedStoryId }?.title) }
                    item {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                            SectionLabel("In the running", modifier = Modifier.weight(1f))
                            Text("${pool.entries.size} stories", style = MaterialTheme.typography.labelMedium, color = BrandTextMuted)
                        }
                    }
                    items(pool.entries, key = { it.storyId }) { entry ->
                        EntryCard(
                            entry = entry,
                            cover = state.covers[entry.storyId],
                            selected = entry.storyId == (state.votedStoryId ?: state.selectedStoryId),
                            voted = entry.storyId == state.votedStoryId,
                            locked = state.votedStoryId != null || pool.phase != "voting",
                            showResults = pool.phase != "voting",
                            onClick = {
                                haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                viewModel.select(entry.storyId)
                            },
                        )
                    }
                }
            }
        }

        if (pool != null && !state.loading) {
            Spacer(Modifier.height(10.dp))
            when {
                pool.phase == "voting" && state.votedStoryId == null -> GoldButton(
                    text = when {
                        state.working -> "Sealing your vote…"
                        state.selectedStoryId == null -> "Pick a story to vote for"
                        else -> "Cast a blind vote"
                    },
                    onClick = {
                        haptics.performHapticFeedback(HapticFeedbackType.LongPress)
                        viewModel.vote(voter)
                    },
                    enabled = state.selectedStoryId != null && !state.working,
                    height = 50.dp,
                    modifier = Modifier.fillMaxWidth(),
                )

                pool.phase == "reveal" && !state.revealed -> GoldButton(
                    text = if (state.votedStoryId == null) "No vote from this device" else "Reveal my vote",
                    onClick = { viewModel.reveal(voter) },
                    enabled = state.votedStoryId != null && !state.working,
                    height = 50.dp,
                    modifier = Modifier.fillMaxWidth(),
                )

                else -> Unit
            }
            state.error?.takeIf { !state.unavailable }?.let {
                Spacer(Modifier.height(8.dp))
                Text(it, color = BrandError, style = MaterialTheme.typography.bodySmall)
            }
            Spacer(Modifier.height(12.dp))
        }
    }
}

/** Prize, the three phases of the week, and how long the current one has left. */
@Composable
private fun PoolHero(pool: PoolState, now: Long, votedFor: String?) {
    val shape = RoundedCornerShape(BrandRadius.xxl)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(Brush.linearGradient(listOf(BrandGold.copy(alpha = 0.22f), BrandPanel, BrandPanel)))
            .border(BorderStroke(1.dp, BrandGold.copy(alpha = 0.4f)), shape)
            .padding(18.dp),
    ) {
        SectionLabel("Prize pool · week ${pool.poolId}", color = BrandGold)
        Row(verticalAlignment = Alignment.Bottom) {
            Text(
                trimZeros(pool.solPrize),
                style = MaterialTheme.typography.headlineMedium.copy(fontSize = 44.sp, fontWeight = FontWeight.Bold),
                color = BrandGoldLight,
            )
            Spacer(Modifier.width(8.dp))
            Text("SOL", style = MaterialTheme.typography.titleMedium, color = BrandGold, modifier = Modifier.padding(bottom = 8.dp))
        }
        Text(
            "${pool.totalVotes} ${if (pool.totalVotes == 1) "vote" else "votes"} sealed · the winning storyteller takes the prize",
            style = MaterialTheme.typography.bodySmall,
            color = BrandTextMuted,
        )

        Spacer(Modifier.height(16.dp))
        val phases = listOf("voting" to "Vote", "reveal" to "Reveal", "done" to "Results")
        val current = when (pool.phase) { "voting" -> 0; "reveal" -> 1; else -> 2 }
        Row(verticalAlignment = Alignment.CenterVertically) {
            phases.forEachIndexed { i, (_, label) ->
                PhaseDot(label = label, state = when { i < current -> -1; i == current -> 0; else -> 1 })
                if (i < phases.lastIndex) {
                    Box(
                        Modifier
                            .weight(1f)
                            .height(2.dp)
                            .padding(horizontal = 6.dp)
                            .background(if (i < current) BrandGold else BrandBorder),
                    )
                }
            }
        }

        Spacer(Modifier.height(14.dp))
        val (label, until) = when (pool.phase) {
            "voting" -> "Voting closes in" to pool.voteCloseAt
            "reveal" -> "Reveal window closes in" to pool.revealCloseAt
            else -> "Next round starts soon" to 0L
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(label, style = MaterialTheme.typography.bodyMedium, color = BrandText, modifier = Modifier.weight(1f))
            if (until > 0) {
                Text(
                    countdown(until - now),
                    style = MaterialTheme.typography.titleMedium.copy(fontWeight = FontWeight.Bold),
                    color = BrandGold,
                )
            }
        }
        if (votedFor != null) {
            Spacer(Modifier.height(10.dp))
            Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(Icons.Filled.Lock, contentDescription = null, tint = BrandGold, modifier = Modifier.size(14.dp))
                Spacer(Modifier.width(6.dp))
                Text(
                    if (pool.phase == "voting") "Your vote for \"$votedFor\" is sealed until the reveal."
                    else "You voted for \"$votedFor\".",
                    style = MaterialTheme.typography.bodySmall,
                    color = BrandTextMuted,
                    maxLines = 2,
                )
            }
        }
    }
}

/** -1 done, 0 current, 1 upcoming. */
@Composable
private fun PhaseDot(label: String, state: Int) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Box(
            contentAlignment = Alignment.Center,
            modifier = Modifier
                .size(26.dp)
                .clip(CircleShape)
                .background(if (state <= 0) BrandGold else BrandPanel)
                .border(BorderStroke(1.dp, if (state <= 0) BrandGold else BrandBorder), CircleShape),
        ) {
            if (state < 0) Icon(Icons.Filled.Check, contentDescription = null, tint = BrandBackground, modifier = Modifier.size(14.dp))
            if (state == 0) Box(Modifier.size(8.dp).clip(CircleShape).background(BrandBackground))
        }
        Spacer(Modifier.height(4.dp))
        Text(label, style = MaterialTheme.typography.labelSmall, color = if (state == 0) BrandGold else BrandTextMuted)
    }
}

@Composable
private fun EntryCard(
    entry: PoolEntry,
    cover: String?,
    selected: Boolean,
    voted: Boolean,
    locked: Boolean,
    showResults: Boolean,
    onClick: () -> Unit,
) {
    val shape = RoundedCornerShape(BrandRadius.xxl)
    val border by animateColorAsState(if (selected) BrandGold else BrandBorder, label = "border")
    val lift by animateFloatAsState(if (selected) 1.02f else 1f, spring(dampingRatio = 0.6f), label = "lift")
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .graphicsLayer { scaleX = lift; scaleY = lift }
            .clip(shape)
            .background(if (selected) BrandGoldDim else BrandPanel)
            .border(BorderStroke(if (selected) 1.5.dp else 1.dp, border), shape)
            .clickable(enabled = !locked, onClick = onClick)
            .padding(10.dp),
    ) {
        Box {
            CoverImage(
                cover,
                Modifier.size(58.dp).clip(RoundedCornerShape(BrandRadius.md)),
                seed = CoverArt.seedOf(entry.storyId),
                sizePx = 168,
            )
            if (showResults && entry.rank in 1..3) {
                Box(
                    contentAlignment = Alignment.Center,
                    modifier = Modifier
                        .align(Alignment.TopStart)
                        .padding(3.dp)
                        .size(20.dp)
                        .clip(CircleShape)
                        .background(BrandGold),
                ) {
                    Text("${entry.rank}", style = MaterialTheme.typography.labelSmall, color = BrandBackground)
                }
            }
        }
        Spacer(Modifier.width(12.dp))
        Column(Modifier.weight(1f)) {
            Text(
                entry.title.ifBlank { "Untitled" },
                style = MaterialTheme.typography.titleSmall,
                color = BrandText,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                listOfNotNull(
                    entry.category.ifBlank { null },
                    entry.durationSeconds.takeIf { it > 0 }?.let { "${it / 60}:${"%02d".format(it % 60)}" },
                    entry.authorWallet.takeIf { it.length > 8 }?.let { "${it.take(4)}…${it.takeLast(4)}" },
                ).joinToString(" · "),
                style = MaterialTheme.typography.bodySmall,
                color = BrandTextMuted,
                maxLines = 1,
            )
            if (showResults) {
                Spacer(Modifier.height(4.dp))
                Text(
                    "${entry.revealCount} revealed · ${entry.commitCount} sealed",
                    style = MaterialTheme.typography.labelSmall,
                    color = BrandTextFaint,
                )
            }
        }
        when {
            voted -> Badge("Your vote")
            selected -> Icon(Icons.Filled.Check, contentDescription = "Selected", tint = BrandGold)
        }
    }
}

@Composable
private fun Badge(text: String) {
    Box(
        Modifier
            .clip(RoundedCornerShape(BrandRadius.pill))
            .background(BrandGold)
            .padding(horizontal = 8.dp, vertical = 3.dp),
    ) {
        Text(text, style = MaterialTheme.typography.labelSmall, color = BrandBackground)
    }
}

private fun trimZeros(value: Double): String =
    if (value % 1.0 == 0.0) value.toLong().toString() else "%.2f".format(value).trimEnd('0').trimEnd('.')

private fun countdown(seconds: Long): String {
    if (seconds <= 0) return "now"
    val d = seconds / 86_400
    val h = (seconds % 86_400) / 3600
    val m = (seconds % 3600) / 60
    val s = seconds % 60
    return when {
        d > 0 -> "${d}d ${h}h ${m}m"
        h > 0 -> "${h}h ${m}m ${s}s"
        else -> "${m}m ${s}s"
    }
}
