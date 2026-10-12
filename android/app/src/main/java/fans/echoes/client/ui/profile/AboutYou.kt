package fans.echoes.client.ui.profile

import androidx.compose.animation.AnimatedContent
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.animateContentSize
import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.expandVertically
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.shrinkVertically
import androidx.compose.animation.slideInVertically
import androidx.compose.animation.slideOutVertically
import androidx.compose.animation.togetherWith
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.KeyboardArrowDown
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.hapticfeedback.HapticFeedbackType
import androidx.compose.ui.platform.LocalHapticFeedback
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import fans.echoes.client.ui.theme.BrandBorder
import fans.echoes.client.ui.theme.BrandChip
import fans.echoes.client.ui.theme.BrandError
import fans.echoes.client.ui.theme.BrandGold
import fans.echoes.client.ui.theme.BrandRadius
import fans.echoes.client.ui.theme.BrandText
import fans.echoes.client.ui.theme.BrandTextFaint
import fans.echoes.client.ui.theme.BrandTextMuted
import fans.echoes.client.ui.theme.GlassCard
import fans.echoes.client.ui.theme.GoldButton
import fans.echoes.client.ui.theme.SectionLabel
import fans.echoes.client.ui.theme.brandFieldColors
import java.util.Locale

/** The website onboarding's options, so answers mean the same thing everywhere. */
private val GENDERS = listOf("male" to "Male", "female" to "Female", "non-binary" to "Non-binary", "prefer not to say" to "Prefer not to say")
private val STATUSES = listOf("employed" to "Employed", "unemployed" to "Unemployed", "student" to "Student", "retired" to "Retired")
private val GOALS = listOf(
    "tell" to "Tell my stories",
    "listen" to "Listen to others",
    "earn" to "Make some money",
    "inspire" to "Get inspired",
)
private val COMMON_LANGUAGES = listOf(
    "English", "Ukrainian", "Spanish", "Portuguese", "French", "German", "Polish",
    "Russian", "Turkish", "Hindi", "Chinese", "Japanese", "Korean", "Arabic",
)

private data class Question(val label: String, val prompt: String)

private val QUESTIONS = listOf(
    Question("Age", "How old are you?"),
    Question("Gender", "How do you describe yourself?"),
    Question("Occupation", "What do you do these days?"),
    Question("Country", "Where are you from?"),
    Question("Languages", "Which languages do you speak?"),
    Question("Here for", "What brings you to Echoes?"),
    Question("X", "Your X handle, so listeners can find you"),
)

/** Country names in the phone's language, for suggestions while typing. */
private val COUNTRIES: List<String> by lazy {
    Locale.getISOCountries().map { Locale.Builder().setRegion(it).build().getDisplayCountry(Locale.ENGLISH) }
        .filter { it.isNotBlank() }.distinct().sorted()
}

/**
 * "About you" the way the website's onboarding asks it: one question at a time,
 * each answered before the next appears — nothing can be skipped (the X handle
 * has an explicit "I don't use X"). Answers fold into a list above the open
 * question, each tap-to-change. When everything is answered the card collapses
 * to a summary; tapping it opens it again.
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun AboutYouCard(
    state: ProfileUiState,
    onAge: (String) -> Unit,
    onGender: (String) -> Unit,
    onStatus: (String) -> Unit,
    onCountry: (String) -> Unit,
    onToggleLanguage: (String) -> Unit,
    onLanguages: (String) -> Unit,
    onToggleGoal: (String) -> Unit,
    onTwitter: (String) -> Unit,
    onNoTwitter: (Boolean) -> Unit,
    onNext: () -> Unit,
    onEdit: (Int) -> Unit,
    onExpand: (Boolean) -> Unit,
    onSave: () -> Unit,
) {
    val haptics = LocalHapticFeedback.current
    val step = state.step.coerceIn(0, PROFILE_QUESTIONS)
    val complete = (0 until PROFILE_QUESTIONS).all { answered(state, it) }
    val answeredCount = (0 until PROFILE_QUESTIONS).count { answered(state, it) }
    val progress by animateFloatAsState(answeredCount / PROFILE_QUESTIONS.toFloat(), label = "progress")
    val next = {
        if (answered(state, step)) {
            haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
            onNext()
        }
    }
    val expanded = state.aboutExpanded || !complete
    val chevron by animateFloatAsState(if (expanded) 180f else 0f, label = "chevron")

    GlassCard(modifier = Modifier.fillMaxWidth().animateContentSize()) {
        // Header: tap to fold or unfold once everything is answered.
        Row(
            verticalAlignment = Alignment.CenterVertically,
            modifier = Modifier
                .fillMaxWidth()
                .clip(RoundedCornerShape(BrandRadius.lg))
                .clickable(enabled = complete) { onExpand(!expanded) },
        ) {
            SectionLabel("About you", modifier = Modifier.weight(1f))
            if (complete) {
                Icon(Icons.Filled.Check, contentDescription = null, tint = BrandGold, modifier = Modifier.size(16.dp))
                Spacer(Modifier.width(6.dp))
            }
            Text("$answeredCount / $PROFILE_QUESTIONS", style = MaterialTheme.typography.labelMedium, color = BrandTextMuted)
            if (complete) {
                Icon(
                    Icons.Filled.KeyboardArrowDown,
                    contentDescription = if (expanded) "Fold" else "Unfold",
                    tint = BrandTextMuted,
                    modifier = Modifier.graphicsLayer { rotationZ = chevron },
                )
            }
        }
        Spacer(Modifier.height(8.dp))
        Box(Modifier.fillMaxWidth().height(3.dp).clip(RoundedCornerShape(BrandRadius.pill)).background(BrandBorder)) {
            Box(Modifier.fillMaxWidth(progress).height(3.dp).background(BrandGold))
        }

        // Folded: the answers at a glance.
        AnimatedVisibility(visible = !expanded, enter = fadeIn() + expandVertically(), exit = fadeOut() + shrinkVertically()) {
            Column(Modifier.padding(top = 10.dp)) {
                Text(
                    (0 until PROFILE_QUESTIONS).map { answerText(it, state) }.filter { it != "—" }.joinToString("  ·  "),
                    style = MaterialTheme.typography.bodySmall,
                    color = BrandText,
                    maxLines = 3,
                )
                if (state.saved) {
                    Spacer(Modifier.height(4.dp))
                    Text("Saved — listeners can now find your stories by audience.", style = MaterialTheme.typography.labelSmall, color = BrandGold)
                }
            }
        }

        AnimatedVisibility(visible = expanded, enter = fadeIn() + expandVertically(), exit = fadeOut() + shrinkVertically()) {
            Column {
                Spacer(Modifier.height(4.dp))
                Text(
                    "Age, country and language are public so listeners can find stories by audience.",
                    style = MaterialTheme.typography.bodySmall,
                    color = BrandTextMuted,
                )

                // Answered so far; tap one to change it.
                for (i in 0 until PROFILE_QUESTIONS) {
                    if (i != step && answered(state, i)) {
                        AnswerRow(QUESTIONS[i].label, answerText(i, state), onEdit = { onEdit(i) })
                    }
                }

                AnimatedContent(
                    targetState = step,
                    transitionSpec = {
                        (slideInVertically { it / 3 } + fadeIn()) togetherWith (slideOutVertically { -it / 3 } + fadeOut())
                    },
                    label = "question",
                ) { index ->
                    if (index >= PROFILE_QUESTIONS) {
                        Column(Modifier.padding(top = 12.dp)) {
                            Text(
                                if (state.saving) "Saving…" else if (state.saved) "All set. Tap the title to fold this card." else "Everything is answered.",
                                style = MaterialTheme.typography.bodyMedium,
                                color = if (state.saved) BrandGold else BrandText,
                            )
                            state.error?.let {
                                Spacer(Modifier.height(6.dp))
                                Text(it, style = MaterialTheme.typography.bodySmall, color = BrandError)
                            }
                            if (!state.saved && !state.saving) {
                                Spacer(Modifier.height(10.dp))
                                GoldButton("Save profile", onClick = onSave, height = 46.dp, modifier = Modifier.fillMaxWidth())
                            }
                        }
                        return@AnimatedContent
                    }
                    Column(Modifier.padding(top = 14.dp)) {
                        Text(QUESTIONS[index].prompt, style = MaterialTheme.typography.titleMedium, color = BrandText)
                        Spacer(Modifier.height(10.dp))
                        when (index) {
                            0 -> {
                                QuestionField(state.age, onAge, "Your age", KeyboardType.Number, next)
                                if (state.age.isNotBlank() && !answered(state, 0)) {
                                    Hint("Enter an age between 13 and 110.")
                                }
                            }
                            1 -> ChoiceRow(GENDERS, state.gender) { onGender(it); haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); onNext() }
                            2 -> ChoiceRow(STATUSES, state.status) { onStatus(it); haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove); onNext() }
                            3 -> CountryField(state.country, onCountry, next)
                            4 -> LanguagesPicker(state.languages, onToggleLanguage, onLanguages)
                            5 -> FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                                GOALS.forEach { (value, label) ->
                                    BrandChip(label, selected = value in state.goals, onClick = {
                                        haptics.performHapticFeedback(HapticFeedbackType.TextHandleMove)
                                        onToggleGoal(value)
                                    })
                                }
                            }
                            6 -> Column {
                                QuestionField(state.twitter, onTwitter, "handle", KeyboardType.Text, next, prefix = "@", enabled = !state.noTwitter)
                                Row(
                                    verticalAlignment = Alignment.CenterVertically,
                                    modifier = Modifier.clip(RoundedCornerShape(BrandRadius.lg)).clickable { onNoTwitter(!state.noTwitter) },
                                ) {
                                    Checkbox(
                                        checked = state.noTwitter,
                                        onCheckedChange = onNoTwitter,
                                        colors = CheckboxDefaults.colors(checkedColor = BrandGold, uncheckedColor = BrandTextMuted),
                                    )
                                    Text("I don't use X", style = MaterialTheme.typography.bodyMedium, color = BrandText)
                                }
                            }
                        }
                        // Chips that answer in one tap move on by themselves; the rest confirm.
                        if (index != 1 && index != 2) {
                            Spacer(Modifier.height(12.dp))
                            GoldButton(
                                text = if (index == PROFILE_QUESTIONS - 1) "Finish" else "Next",
                                onClick = next,
                                enabled = answered(state, index),
                                height = 44.dp,
                                modifier = Modifier.fillMaxWidth(),
                            )
                        }
                    }
                }
            }
        }
    }
}

private fun answerText(index: Int, s: ProfileUiState): String {
    fun label(options: List<Pair<String, String>>, value: String) =
        options.firstOrNull { it.first == value }?.second ?: value
    return when (index) {
        0 -> s.age.takeIf { it.isNotBlank() }?.let { "$it y.o." }.orEmpty()
        1 -> label(GENDERS, s.gender)
        2 -> label(STATUSES, s.status)
        3 -> s.country
        4 -> s.languages
        5 -> GOALS.filter { it.first in s.goals }.joinToString(", ") { it.second }
        else -> when {
            s.twitter.isNotBlank() -> "@${s.twitter}"
            s.noTwitter -> "No X"
            else -> ""
        }
    }.ifBlank { "—" }
}

@Composable
private fun AnswerRow(label: String, value: String, onEdit: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(BrandRadius.lg))
            .clickable(onClick = onEdit)
            .padding(vertical = 8.dp),
    ) {
        Icon(Icons.Filled.Check, contentDescription = null, tint = BrandGold, modifier = Modifier.size(14.dp))
        Spacer(Modifier.width(8.dp))
        Text(label, style = MaterialTheme.typography.bodySmall, color = BrandTextMuted, modifier = Modifier.weight(0.35f))
        Text(value, style = MaterialTheme.typography.bodyMedium, color = BrandText, modifier = Modifier.weight(0.65f), maxLines = 1)
        Text("Change", style = MaterialTheme.typography.labelMedium, color = BrandTextFaint)
    }
}

@Composable
private fun Hint(text: String) {
    Spacer(Modifier.height(4.dp))
    Text(text, style = MaterialTheme.typography.bodySmall, color = BrandTextMuted)
}

@Composable
private fun QuestionField(
    value: String,
    onChange: (String) -> Unit,
    placeholder: String,
    keyboard: KeyboardType,
    onDone: () -> Unit,
    prefix: String? = null,
    enabled: Boolean = true,
) {
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        placeholder = { Text(placeholder, color = BrandTextFaint) },
        prefix = prefix?.let { { Text(it, color = BrandTextMuted) } },
        singleLine = true,
        enabled = enabled,
        keyboardOptions = KeyboardOptions(keyboardType = keyboard, imeAction = ImeAction.Next, capitalization = KeyboardCapitalization.Words),
        keyboardActions = KeyboardActions(onNext = { onDone() }),
        shape = RoundedCornerShape(BrandRadius.xl),
        colors = brandFieldColors(),
        modifier = Modifier.fillMaxWidth(),
    )
}

/** Type a few letters, then tap the country. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun CountryField(value: String, onChange: (String) -> Unit, onDone: () -> Unit) {
    QuestionField(value, onChange, "Start typing a country", KeyboardType.Text, onDone)
    val matches = remember(value) {
        if (value.length < 2 || COUNTRIES.any { it.equals(value, ignoreCase = true) }) emptyList()
        else COUNTRIES.filter { it.startsWith(value, ignoreCase = true) || it.contains(" $value", ignoreCase = true) }.take(6)
    }
    if (matches.isNotEmpty()) {
        Spacer(Modifier.height(8.dp))
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            matches.forEach { country -> BrandChip(country, selected = false, onClick = { onChange(country) }) }
        }
    }
}

/** Common languages as chips, plus a field for any other. */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun LanguagesPicker(value: String, onToggle: (String) -> Unit, onChange: (String) -> Unit) {
    val chosen = value.split(',').map(String::trim).filter(String::isNotEmpty)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        COMMON_LANGUAGES.forEach { lang ->
            BrandChip(lang, selected = chosen.any { it.equals(lang, ignoreCase = true) }, onClick = { onToggle(lang) })
        }
    }
    Spacer(Modifier.height(10.dp))
    OutlinedTextField(
        value = value,
        onValueChange = onChange,
        label = { Text("Your languages") },
        placeholder = { Text("Tap above or type, separated by commas", color = BrandTextFaint) },
        singleLine = true,
        shape = RoundedCornerShape(BrandRadius.xl),
        colors = brandFieldColors(),
        modifier = Modifier.fillMaxWidth(),
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ChoiceRow(options: List<Pair<String, String>>, selected: String, onPick: (String) -> Unit) {
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
        options.forEach { (value, label) ->
            BrandChip(label, selected = value == selected, onClick = { onPick(value) })
        }
    }
}
