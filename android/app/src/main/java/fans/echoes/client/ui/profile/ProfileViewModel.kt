package fans.echoes.client.ui.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import fans.echoes.client.data.api.UserProfile
import fans.echoes.client.data.api.userMessage
import fans.echoes.client.data.repo.AccountRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class ProfileUiState(
    val loading: Boolean = true,
    val saving: Boolean = false,
    val saved: Boolean = false,
    val wallet: String = "",
    val age: String = "",
    val country: String = "",
    val languages: String = "",
    val twitter: String = "",
    val gender: String = "",
    val status: String = "",
    val goals: Set<String> = emptySet(),
    /** Which "about you" question is open; answered ones collapse above it. */
    val step: Int = 0,
    /** The completed card folds into a summary; tapping it opens it again. */
    val aboutExpanded: Boolean = true,
    /** "I'm not on X" counts as an answer to the last question. */
    val noTwitter: Boolean = false,
    val devices: List<fans.echoes.client.data.api.DeviceDto> = emptyList(),
    val devicesAvailable: Boolean = true,
    val removingDevice: String? = null,
    val seekerVerified: Boolean = false,
    val seekerAvailable: Boolean = false,
    val seekerChecking: Boolean = false,
    val seekerMessage: String? = null,
    val referralCode: String? = null,
    val referralCount: Int = 0,
    val deleteOpen: Boolean = false,
    val deleteConfirm: String = "",
    val deleting: Boolean = false,
    val error: String? = null,
)

/** Age, gender, status, country, languages, goals, X handle — the website's onboarding questions. */
const val PROFILE_QUESTIONS = 7

/** Whether question [index] has a usable answer. */
fun answered(s: ProfileUiState, index: Int): Boolean = when (index) {
    0 -> s.age.toIntOrNull()?.let { it in 13..110 } == true
    1 -> s.gender.isNotBlank()
    2 -> s.status.isNotBlank()
    3 -> s.country.isNotBlank()
    4 -> s.languages.isNotBlank()
    5 -> s.goals.isNotEmpty()
    6 -> s.twitter.isNotBlank() || s.noTwitter
    else -> true
}

class ProfileViewModel : ViewModel() {

    private val _state = MutableStateFlow(ProfileUiState())
    val state: StateFlow<ProfileUiState> = _state.asStateFlow()

    fun load(wallet: String) {
        if (_state.value.wallet == wallet && !_state.value.loading) return
        _state.update { it.copy(loading = true, wallet = wallet, error = null) }
        viewModelScope.launch {
            val profile = AccountRepository.profile()
            val referral = AccountRepository.referral(wallet)
            _state.update {
                it.copy(
                    loading = false,
                    age = profile?.age?.toString().orEmpty(),
                    country = profile?.country.orEmpty(),
                    languages = profile?.languages.orEmpty(),
                    twitter = profile?.twitter.orEmpty(),
                    // A saved profile with goals but no handle already answered "not on X".
                    noTwitter = profile?.twitter.isNullOrBlank() && !profile?.goals.isNullOrBlank(),
                    gender = profile?.gender.orEmpty(),
                    status = profile?.status.orEmpty(),
                    goals = profile?.goals.orEmpty().split(',').map(String::trim).filter(String::isNotEmpty).toSet(),
                    referralCode = referral.code,
                    referralCount = referral.count,
                )
            }
            _state.update {
                val step = firstUnanswered(it)
                it.copy(step = step, aboutExpanded = step < PROFILE_QUESTIONS)
            }
            refreshDevices()
            val seeker = AccountRepository.seekerStatus()
            _state.update { it.copy(seekerVerified = seeker.verified, seekerAvailable = seeker.available) }
        }
    }

    fun refreshDevices() {
        viewModelScope.launch {
            runCatching { AccountRepository.devices() }
                .onSuccess { r -> _state.update { it.copy(devices = r.devices, devicesAvailable = r.available) } }
                .onFailure { _state.update { it.copy(devicesAvailable = false) } }
        }
    }

    /** Signs another device out. Signing out this one goes through [onSignOut] instead. */
    fun removeDevice(id: String) {
        if (_state.value.removingDevice != null) return
        _state.update { it.copy(removingDevice = id, error = null) }
        viewModelScope.launch {
            runCatching { AccountRepository.removeDevice(id) }
                .onSuccess { _state.update { s -> s.copy(removingDevice = null, devices = s.devices.filterNot { d -> d.id == id }) } }
                .onFailure { e -> _state.update { it.copy(removingDevice = null, error = e.userMessage()) } }
        }
    }

    fun verifySeeker() {
        if (_state.value.seekerChecking) return
        _state.update { it.copy(seekerChecking = true, seekerMessage = null) }
        viewModelScope.launch {
            runCatching { AccountRepository.verifySeeker() }
                .onSuccess { r ->
                    _state.update {
                        it.copy(
                            seekerChecking = false,
                            seekerVerified = r.verified,
                            seekerMessage = if (r.verified) "Verified Seeker owner." else r.reason,
                        )
                    }
                }
                .onFailure { e -> _state.update { it.copy(seekerChecking = false, seekerMessage = e.userMessage()) } }
        }
    }

    // ── "About you", one question at a time ───────────────────────────────────

    fun setGender(value: String) = _state.update { it.copy(gender = value, saved = false) }
    fun setStatus(value: String) = _state.update { it.copy(status = value, saved = false) }
    fun toggleGoal(value: String) = _state.update {
        it.copy(goals = if (value in it.goals) it.goals - value else it.goals + value, saved = false)
    }

    /**
     * Moves on once the open question is answered — questions cannot be skipped.
     * Editing an earlier answer jumps back to the first one still missing, and
     * when none is missing the answers are saved and the card folds away.
     */
    fun nextStep() {
        val s = _state.value
        if (!answered(s, s.step)) return
        val next = (0 until PROFILE_QUESTIONS).firstOrNull { !answered(s, it) } ?: PROFILE_QUESTIONS
        _state.update { it.copy(step = next) }
        if (next >= PROFILE_QUESTIONS) {
            save()
            _state.update { it.copy(aboutExpanded = false) }
        }
    }

    fun editStep(index: Int) = _state.update { it.copy(step = index, saved = false, aboutExpanded = true) }

    fun setAboutExpanded(open: Boolean) = _state.update {
        it.copy(aboutExpanded = open, step = if (open) it.step.coerceAtMost(PROFILE_QUESTIONS) else it.step)
    }

    fun setNoTwitter(value: Boolean) = _state.update { it.copy(noTwitter = value, twitter = if (value) "" else it.twitter, saved = false) }

    fun toggleLanguage(value: String) = _state.update {
        val set = it.languages.split(',').map(String::trim).filter(String::isNotEmpty).toMutableList()
        if (set.any { l -> l.equals(value, ignoreCase = true) }) set.removeAll { l -> l.equals(value, ignoreCase = true) } else set += value
        it.copy(languages = set.joinToString(", ").take(80), saved = false)
    }

    private fun firstUnanswered(s: ProfileUiState): Int =
        (0 until PROFILE_QUESTIONS).firstOrNull { !answered(s, it) } ?: PROFILE_QUESTIONS

    fun setAge(value: String) = _state.update { it.copy(age = value.filter(Char::isDigit).take(3), saved = false) }
    fun setCountry(value: String) = _state.update { it.copy(country = value.take(60), saved = false) }
    fun setLanguages(value: String) = _state.update { it.copy(languages = value.take(80), saved = false) }
    fun setTwitter(value: String) = _state.update { it.copy(twitter = value.removePrefix("@").take(30), saved = false) }

    fun openDelete(open: Boolean) = _state.update { it.copy(deleteOpen = open, deleteConfirm = "", error = null) }
    fun setDeleteConfirm(value: String) = _state.update { it.copy(deleteConfirm = value) }

    /**
     * Erases the account. The store policy requires this to be reachable from
     * inside the app, and the server needs an explicit confirmation word.
     */
    fun deleteAccount(onDeleted: () -> Unit) {
        if (_state.value.deleting || _state.value.deleteConfirm != "DELETE") return
        _state.update { it.copy(deleting = true, error = null) }
        viewModelScope.launch {
            runCatching { AccountRepository.deleteAccount() }
                .onSuccess {
                    _state.update { it.copy(deleting = false, deleteOpen = false) }
                    onDeleted()
                }
                .onFailure { e ->
                    _state.update { it.copy(deleting = false, error = e.userMessage()) }
                }
        }
    }

    fun save() {
        val snapshot = _state.value
        if (snapshot.wallet.isBlank() || snapshot.saving) return
        _state.update { it.copy(saving = true, error = null) }
        viewModelScope.launch {
            runCatching {
                AccountRepository.saveProfile(
                    UserProfile(
                        wallet = snapshot.wallet,
                        age = snapshot.age.toIntOrNull(),
                        gender = snapshot.gender.ifBlank { null },
                        status = snapshot.status.ifBlank { null },
                        country = snapshot.country.ifBlank { null },
                        languages = snapshot.languages.ifBlank { null },
                        goals = snapshot.goals.takeIf { it.isNotEmpty() }?.joinToString(","),
                        twitter = snapshot.twitter.ifBlank { null },
                    ),
                )
            }.onSuccess {
                _state.update { it.copy(saving = false, saved = true) }
            }.onFailure { e ->
                _state.update { it.copy(saving = false, error = e.userMessage()) }
            }
        }
    }
}
