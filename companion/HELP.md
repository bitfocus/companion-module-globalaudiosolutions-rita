## RiTA (Global Audio Solutions)

Controls RiTA through its WebSocket API (`ws://<ip>:26101/api/v1/`).

Requires **RiTA 2.8.0 or later**. With an older RiTA the module still connects and most of it works, but whatever that version's API does not have (mute groups, the average, the alignment APFs, the clear actions, change events) is simply not there, and those actions are rejected.

### Configuration

- **RiTA IP address**: the machine running RiTA with the API enabled.
- **Control port**: 26101 by default. RiTA serves one client per port, so the module tries this port and the next four.
- **Password**: only if the API password is enabled in RiTA. If it is changed in RiTA while connected, the module logs in again on its own (within 30 s). A wrong password is not retried until the configuration is saved again, because RiTA locks the connection after 5 attempts.
- **Level meter poll interval**: RiTA sends an event whenever something the module shows changes, except the engine level meters, which are read at this interval. On an older RiTA without events, everything is read at this interval.

### Actions

- **Generator**: Spectrum on/off, signal, gain, duration, outputs.
- **Settings**: FFT size, window, smoothing, spectrum averages, averaging, sum, plot style, coherence threshold, DSP type, reference mode, measurement mode.
- **Measurement**: capture, activate engine, find delay, set delay, set inputs, rename, sync all, clear find, clear delays, clear everything, export all.
- **Memory**: store the trace of an engine, show/hide, rename, delete.
- **AVG**: on/off, export impulse.
- **Mute group**: mute, unmute or toggle one of the 4 mute buttons of the external processor.
- **DSP**: channel gain (absolute or step), delay, polarity, name, clear, EQ filter (1-20) and its on/off, alignment APF (1-2) and its on/off, high-pass and low-pass.
- **Advanced: send API command**: any request with a JSON properties field, for objects not covered above.

When RiTA would have shown a message box, it answers anyway and puts the text in the reply; the module writes those to the log as "RiTA: …". Warnings and errors reported by a capture or an export show up there too.

**Capture** measures on an engine with the current signal, and turns the engine on. While a continuous measurement (Spectrum) is running, a one-shot capture is refused: stop it first with **Generator: Spectrum on / off**.
- With Sweep, Multi Sweep, Pink or External it measures once. RiTA does not answer anything while it measures; the module waits for the estimated duration and then writes the result (or the error RiTA reports) to the log.
- With Spectrum it starts measuring continuously on that engine (or adds the engine if it is already running) until the generator is stopped. RiTA keeps answering while it runs.

**Spectrum on/off** selects Spectrum if needed and measures it on the chosen engine; off stops it. It can run on several engines: deactivate one with **Measurement: activate engine**.

**Live TF** is not offered by RiTA 2.8.0: it is not in the signal list and the generator has no pink noise switch.

**Measurement: set inputs** sets the inputs of that engine. In **1 Ref. Channel** mode the reference input goes to all eight engines, and in **1 Meas. Channel** mode so does the measurement input: RiTA says which in its reply and the module writes it to the log.

**Reference mode** and **measurement mode** are the two channel modes of RiTA's Preferences. With *Several*, each engine has its own input. With **1 Ref. Channel** or **1 Meas. Channel** the eight engines share that input, so writing it on one engine writes it on all of them. RiTA puts itself in 1 Meas. Channel when a two-input sound card is chosen. In that mode turning one engine on turns the others off, in RiTA and from here alike, and **Measurement: activate engine** writes to the log which ones were turned off; with the Spectrum signal several can still be on. The module reads the eight engines again after a change of mode. Both modes are in RiTA 2.8.0: on an earlier RiTA (a 2.8.0 beta or before) the two actions are refused and the variables stay empty.

**EQ filters** start disabled in RiTA: a filter that is not enabled is stored but does not sound. Gain applies to Parametric and the shelving types, order to APF and FIR RevPhase.

In the **crossovers** (high-pass and low-pass) the last number is not a Q: it is the passband ripple in dB on Chebyshev I and Eliptic, the stopband attenuation in dB on Chebyshev II, and Butterworth, Linkwitz-Riley and Bessel ignore it. It takes 0.1 to 120. The Q of the **EQ filters** is a real Q factor, 0.1 to 10. Both are numbers of RiTA's own filter model: with another **DSP type** they become that processor's numbers, the ones its own screen shows.

**DSP type** is the *DSP Type* of RiTA's Preferences > DSP: the filter model RiTA draws and computes its DSP with, its own or the one of an external processor (Kingray, Marani, Galaxy). Changing it makes RiTA convert the filters of the eight channels so the curves do not change, which moves the numbers: the Q of the Parametric and shelving filters and the frequency of the Bessel crossovers (a +12 dB bell with Q 2 becomes Q 3.99 in Kingray). What does not fit the new model is left at that processor's limit, so a +18 dB bell becomes +15 dB in Kingray, and RiTA's warning about it shows up in the log as "RiTA: …". The module writes the change to the log and reads the channels again, and it does the same when the type is changed in RiTA itself. Anything read before the change is a number of the old model.

DSP type is in RiTA 2.8.0. On an earlier RiTA (a 2.8.0 beta or before) the action is refused with "This RiTA has no DSP Type" and `$(rita:settings_dsp_type)` stays empty; everything else works as usual. The dropdown also takes a typed name, for a newer RiTA that knows more processors.

**Alignment APFs** are the 2 all-pass filters per channel that RiTA's Auto Align writes (it replaces both on every run), separate from the 20 EQ filters. They can also be set by hand: frequency, order (1 or 2) and Q. The module follows them, so buttons update after an Auto Align. Older RiTA versions do not have them.

**Mute groups** are the 4 assignable mute buttons of the external processor (DAP0408F, GALAXY, Marani…). Which channels belong to each group is set in RiTA, not from here, and a group can mix channels of several processors. *Toggle* does what the button does: it unmutes the group when every channel is muted, and mutes it otherwise. Feedbacks: **Mute group is muted** (red) and **Mute group has channels**; the name given in RiTA is in `$(rita:mute_group_N_name)`, so it can be the button text. A group with no channels on a connected processor answers "no channels", and a channel the processor did not take is written to the log.

**AVG** is RiTA's average of the **selected** engines (not the active ones). **AVG: on / off** is the same control as *Settings: averaging on/off*. **AVG: export impulse** writes the impulse response of the average to the Memory Bank folder, in the format chosen in RiTA; the export runs in the background and its result (or error, such as no export folder or AVG off) is written to the log.

**Measurement: sync all** is RiTA's Sync All (button and Y shortcut): it aligns with each other the engines that already have a measurement, without touching AVG. The new delays show up on the buttons at once and are written to the log. With no measured engine it answers "no active measurements".

RiTA does not send events for the sync, so the module reads it with the level meters, at the poll interval: the feedback **Sync All is set** stays on while a sync is in place, **Sync All is possible** says whether any engine has a measurement, and a Sync All done from RiTA writes "Sync All done in RiTA" to the log.

While a sync is in place, RiTA does nothing on a new Sync All (in RiTA the button is disabled): the module says so in the log. Put the feedback **Sync All is set** on the button to see it at a glance.

**Measurement: clear find** removes the sync. **Measurement: clear delays** sets the DSP delay of the 8 channels to 0, and RiTA refuses it while a sync is in place: clear the find first. **Measurement: clear everything** is RiTA's Clear with Everything and with no dialog, so it wipes measurements, DSP and names of every channel.

Each engine has two delays: `meas_N_delay` is the arrival of its measurement, and `meas_N_dsp_delay` is the delay of its DSP channel, which is what Sync All writes.

**Measurement: export all** is RiTA's Export All: it exports the **selected** engines (the engine buttons, `selected` in the API) to the project folder, in the format chosen in RiTA. If a Position is written in RiTA, each file is named `<engine>_<position>` (and the AVG export gets `_<position>` too). The export runs in the background; its result (or error, such as no engine selected or no export folder) is written to the log.

The **Settings** variables follow RiTA and are never put back by the module: if RiTA changes one by itself, that is what the buttons show.

**Linked channels (Link DSP)**: in RiTA a channel can follow another one. The linked parts of the slave channel (gain, delay, polarity, crossovers, EQ filters, alignment APFs and FIRs, each group on its own) cannot be written: those actions do nothing and write "read only, this part of the channel is linked to another one in RiTA" to the log. Rename still works. The API does not say which channel is the master.

**DSP: clear channel is the exception**: on a linked channel it undoes the link and then resets the channel, exactly as RiTA's own Clear button does, with no confirmation.

**DSP: clear channel** is the Clear button of the row: it also clears that engine measurement, and on a linked channel it undoes the link first.

### Feedbacks

Connected, Mute group is muted, Mute group has channels, Sync All is set, Sync All is possible, AVG on, AVG has a curve, generator running, generator signal, engine active, engine selected, DSP type is, Reference mode is, Measurement mode is, DSP polarity inverted, DSP alignment APF enabled.

### Variables

- `$(rita:generator_running)`, `generator_signal`, `generator_gain`, `generator_duration`, `generator_output1`, `generator_output2`
- `$(rita:settings_fft_size)`, `settings_window`, `settings_smoothing`, `settings_spectrum_averages`, `settings_averaging`, `settings_sum`, `settings_coherence_threshold`, `settings_dsp_type`, `settings_reference_mode`, `settings_measurement_mode`
- `$(rita:sync_active)`, `sync_count`, `sync_possible`
- `$(rita:mute_group_N_name)`, `mute_group_N_muted`, `mute_group_N_available` for N = 1..4
- `$(rita:average_active)`, `average_has_data`, `average_count`, `average_engines`, `average_mode`, `average_name`
- `$(rita:dsp_N_name)`, `dsp_N_gain`, `dsp_N_delay`, `dsp_N_polarity` for N = 1..8
- `$(rita:dsp_N_apfK_enabled)`, `dsp_N_apfK_frequency`, `dsp_N_apfK_order`, `dsp_N_apfK_q` for N = 1..8 and K = 1..2
- `$(rita:meas_N_name)`, `meas_N_active`, `meas_N_delay`, `meas_N_dsp_delay`, `meas_N_level` for N = 1..8

In Companion 5 the text shown on a button is set in the button's **Style** tab, **Text** element, **Button text string**.
