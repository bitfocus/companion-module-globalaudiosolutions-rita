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
- **Settings**: FFT size, window, smoothing, spectrum averages, averaging, sum, plot style, coherence threshold, Auto FFT size, DSP type, DSP model, DSP mode, reference mode, measurement mode.
- **Measurement**: capture, activate engine, find delay, set delay, set inputs, rename, sync all, clear find, clear delays, clear everything, export all.
- **Memory**: store the trace of an engine, show/hide, rename, delete.
- **AVG**: on/off, export impulse.
- **Mute group**: mute, unmute or toggle one of the 4 mute buttons of the external processor.
- **DSP**: channel gain (absolute or step), delay, polarity, name, clear, EQ filter (1-20) and its on/off, alignment APF (1-2) and its on/off, high-pass and low-pass.
- **Advanced: send API command**: any request with a JSON properties field, for objects not covered above.

When RiTA would have shown a message box, it answers anyway and puts the text in the reply; the module writes those to the log as "RiTA: …". Warnings and errors reported by a capture or an export show up there too.

**Capture** measures on an engine with the current signal, and turns the engine on. While a continuous measurement (Spectrum) is running, a one-shot capture is refused: stop it first with **Generator: Spectrum on / off**, or with **Generator: set signal**, since from RiTA 2.8.1 beta 03 choosing another signal stops the Spectrum that was running (it takes RiTA about a second and a half, and `$(rita:generator_running)` goes to OFF on its own when it does). On an earlier RiTA the signal changes and Spectrum keeps running out of sight.
- With Sweep, Multi Sweep, Pink or External it measures once. RiTA does not answer anything while it measures; the module waits for the estimated duration and then writes the result (or the error RiTA reports) to the log.
- With Spectrum it starts measuring continuously on that engine (or adds the engine if it is already running) until the generator is stopped. RiTA keeps answering while it runs.

**Spectrum on/off** selects Spectrum if needed and measures it on the chosen engine; off stops it. It can run on several engines: deactivate one with **Measurement: activate engine**.

From RiTA 2.8.1 the **Spectrum** signal has no `64 FPPO` FFT size, nor `128 FPPO` or `65536`: choosing Spectrum moves the size to 32768 on its own, writing one of those while it is selected is refused, and leaving Spectrum brings the size back. The module reads the settings again after every change of signal, so what the buttons show is what RiTA has.

**Settings: Auto FFT size on / off** is the Normal / Auto FFT Size switch of Preferences, off by default. With it on, each engine keeps the next power of two above the length of the sweep, from 65536 to 262144 samples, so a longer sweep gives a longer engine: `$(rita:settings_engine_samples)` is that size in samples and `$(rita:settings_time_constant)` the same thing in seconds, which depends on `$(rita:settings_sample_rate)`. The FFT size list then also offers those sizes and `128 FPPO`, and the delay of a DSP channel reaches as far as the engine lasts, that same number of seconds: 680 ms for every 32768 samples at 48 kHz (5440 with 262144), half of that at 96 kHz. Off, each engine goes back to 32768 and the measurements are cut to it, with RiTA saying so in the log.

Because the engine follows the sweep, **Generator: set duration** changes the engine size too, and the module reads the settings again after it. `$(rita:settings_fft_size_auto)` says whether the switch is on.

The FFT size dropdown offers every size RiTA can ever have, including the big ones. Asking for one RiTA is not offering at that moment is refused, and the module says in the log which of the reasons it is: the switch being off, the size being above the engine of the moment, the Spectrum signal, or a find in place.

**Live TF** is not offered by RiTA 2.8.0: it is not in the signal list and the generator has no pink noise switch.

**Measurement: set inputs** sets the inputs of that engine. In **1 Ref. Channel** mode the reference input goes to all eight engines, and in **1 Meas. Channel** mode so does the measurement input: RiTA says which in its reply and the module writes it to the log.

**Reference mode** and **measurement mode** are the two channel modes of RiTA's Preferences. With *Several*, each engine has its own input. With **1 Ref. Channel** or **1 Meas. Channel** the eight engines share that input, so writing it on one engine writes it on all of them. RiTA puts itself in 1 Meas. Channel when a two-input sound card is chosen. In that mode turning one engine on turns the others off, in RiTA and from here alike, and **Measurement: activate engine** writes to the log which ones were turned off; with the Spectrum signal several can still be on. The module reads the eight engines again after a change of mode. Both modes are in RiTA 2.8.0: on an earlier RiTA (a 2.8.0 beta or before) the two actions are refused and the variables stay empty.

**EQ filters** start disabled in RiTA: a filter that is not enabled is stored but does not sound. Gain applies to Parametric and the shelving types, order to APF and FIR RevPhase.

With DSP type RiTA, Kingray or Galaxy there are five filter types: Parametric, Low Shelf, High Shelf, APF and FIR RevPhase. **A Marani adds its own**, up to 21 in the dropdown, and which of them exist depends on the model and its mode, so one that model does not have is refused: Bell Adaptive Q, Bell Classic Q, the shelvings 1st, 2nd and Slope, Low and High Pass 1st, 2nd and VariQ, Band Pass and Notch. The ones that already existed keep their name, which is RiTA's own and not always the one on the Marani screen: the Marani bell is `Parametric`, its Hi-/Lo-Shelving VariQ are `High Shelf` and `Low Shelf`, and its All Pass is `APF`. The dropdown also takes a typed name.

Each type uses only some of the fields, and the module sends only those: the gain goes to the bells and the shelvings, the order only to APF and FIR RevPhase, and the Q to the bells, the VariQ shelvings and cuts, Band Pass and Notch. On the two Slope shelvings the Q field is not a Q but the slope in dB/oct, 6 to 12. The 1st and 2nd shelvings and cuts use neither Q nor order. With a Marani the Q reaches that model's table, up to 128 (the Notch, 4 to 104), which is why the field goes beyond the 10 of RiTA's own filters.

Each channel also has a number of bands in use, the *Bands* dropdown of RiTA's Equalizer window, 20 by default. From RiTA 2.8.1 a filter above that number cannot be switched on: RiTA refuses it and the filter stays off, while its frequency, type, gain and Q can still be written. The API does not report the band count and RiTA answers the same thing as for a linked channel, so the module writes to the log that the filter is either above the bands in use or in an EQ linked to another channel.

In the **crossovers** (high-pass and low-pass) the last number is not a Q: it is the passband ripple in dB on Chebyshev I and Eliptic, the stopband attenuation in dB on Chebyshev II, and Butterworth, Linkwitz-Riley and Bessel ignore it. It takes 0.1 to 120.

From RiTA 2.8.1, with a processor as DSP type (a Marani, the Kingray DAP0408F or the Galaxy) RiTA checks the crossovers against the model and its mode, the same as its own screen: a type the mode does not have, or an order it does not have, is refused and the module says so in the log. It is no longer moved to the nearest one. With DSP type RiTA nothing changes.

From RiTA 2.8.1 the crossovers have one more type, **NXF**, on the Marani models and modes that have it (MIR FI, A and D, VA DF and MDA kDM; not the MIR E, the kTM or the PDA, and not in the *XOVER-IIR + FIR + 4 PEQ* modes of the MIR); anywhere else it is refused. On an NXF the order is not dB/oct but an attenuation code from 1 to 8 (−40, −45 … −70 and below −75 dB). With NXF on one cut the other can only be None or NXF: RiTA accepts whatever is written, and when the DSP is sent to the processor the other cut goes as None and says so in the log. Both are numbers of RiTA's own filter model: with another **DSP type** they become that processor's numbers, the ones its own screen shows.

**DSP type** is the *DSP Type* of RiTA's Preferences > DSP: the filter model RiTA draws and computes its DSP with, its own or the one of an external processor (Kingray, Marani, Galaxy). Changing it makes RiTA convert the filters of the eight channels so the curves do not change, which moves the numbers: the Q of the Parametric and shelving filters and the frequency of the Bessel crossovers (a +12 dB bell with Q 2 becomes Q 3.99 in Kingray). What does not fit the new model is left at that processor's limit, so a +18 dB bell becomes +15 dB in Kingray, and RiTA's warning about it shows up in the log as "RiTA: …". The module writes the change to the log and reads the channels again, and it does the same when the type is changed in RiTA itself. Anything read before the change is a number of the old model.

DSP type is in RiTA 2.8.0. On an earlier RiTA (a 2.8.0 beta or before) the action is refused with "This RiTA has no DSP Type" and `$(rita:settings_dsp_type)` stays empty; everything else works as usual. The dropdown also takes a typed name, for a newer RiTA that knows more processors.

**DSP model** and **DSP mode**, from RiTA 2.8.1, go with it. The model is the Marani of *Preferences > DSP* (MIR FI, MIR A, MIR D, MIR E, MDA kDM, MDA kTM, PDA and VA DF); setting it puts RiTA in Marani with that model. The mode is the processor channel RiTA models, IN or OUT and, on a Marani, its EQ and crossover mode, with the same labels as the Marani software, for example `OUT: XOVER-IIR + 8 PEQ`. Kingray and Galaxy have an IN and an OUT mode; with DSP type RiTA there are no modes and both variables are empty.

The mode decides how much of the channel there is: how many EQ filters, which crossovers and slopes, and the FIR. Because the labels depend on the model, there are more than forty of them and the API cannot list them, the mode is typed in by hand: `$(rita:settings_dsp_mode)` shows the one in use, and a label that is not of that model is refused. **Settings: DSP model** has a mode field of its own, which sends both in one go, the way RiTA checks them. Changing the model switches off the filters whose type the new model does not have, and RiTA says which in the log.

**Alignment APFs** are the 2 all-pass filters per channel that RiTA's Auto Align writes (it replaces both on every run), separate from the 20 EQ filters. They can also be set by hand: frequency, order (1 or 2) and Q. The module follows them, so buttons update after an Auto Align. Older RiTA versions do not have them.

**Mute groups** are the 4 assignable mute buttons of the external processor (DAP0408F, GALAXY, Marani…). Which channels belong to each group is set in RiTA, not from here, and a group can mix channels of several processors. *Toggle* does what the button does: it unmutes the group when every channel is muted, and mutes it otherwise. Feedbacks: **Mute group is muted** (red) and **Mute group has channels**; the name given in RiTA is in `$(rita:mute_group_N_name)`, so it can be the button text. A group with no channels on a connected processor answers "no channels", and a channel the processor did not take is written to the log.

**AVG** is RiTA's average of the **selected** engines (not the active ones). **AVG: on / off** is the same control as *Settings: averaging on/off*. From RiTA 2.8.1 **AVG and Sum exclude each other**, like their buttons in RiTA: switching one on switches the other off, and the module follows both. **AVG: export impulse** writes the impulse response of the average to the Memory Bank folder, in the format chosen in RiTA; the export runs in the background and its result (or error, such as no export folder or AVG off) is written to the log.

**Measurement: sync all** is RiTA's Sync All (button and Y shortcut): it aligns with each other the engines that already have a measurement, without touching AVG. The new delays show up on the buttons at once and are written to the log. With no measured engine it answers "no active measurements".

RiTA does not send events for the sync, so the module reads it with the level meters, at the poll interval: the feedback **Sync All is set** stays on while a sync is in place, **Sync All is possible** says whether any engine has a measurement, and a Sync All done from RiTA writes "Sync All done in RiTA" to the log.

While a sync is in place, RiTA does nothing on a new Sync All (in RiTA the button is disabled): the module says so in the log. Put the feedback **Sync All is set** on the button to see it at a glance.

**Measurement: clear find** removes the sync. **Measurement: clear delays** sets the DSP delay of the 8 channels to 0, and RiTA refuses it while a sync is in place: clear the find first. **Measurement: clear everything** is RiTA's Clear with Everything and with no dialog, so it wipes measurements, DSP and names of every channel.

Each engine has two delays: `meas_N_delay` is the arrival of its measurement, and `meas_N_dsp_delay` is the delay of its DSP channel, which is what Sync All writes.

**Measurement: export all** is RiTA's Export All: it exports the **selected** engines (the engine buttons, `selected` in the API) to the project folder, in the format chosen in RiTA. The export runs in the background; its result (or error, such as no engine selected or no export folder) is written to the log.

**Settings: export position** is what goes after the name of every exported file, `<engine>_<position>` and `<name>_<position>` for the AVG impulse. From RiTA 2.8.1 RiTA has no Position field on screen and this is the only way to set it: it stays until it is changed, empty means no position, it takes up to 60 characters, and whatever a file name cannot have becomes a dash. The field accepts variables, so a button can stamp the position it belongs to, and `$(rita:settings_export_position)` shows the one in use. RiTA cleans the text up, and the module writes to the log what it really kept.

The **Settings** variables follow RiTA and are never put back by the module: if RiTA changes one by itself, that is what the buttons show.

**Linked channels (Link DSP)**: in RiTA a channel can follow another one. The linked parts of the slave channel (gain, delay, polarity, crossovers, EQ filters, alignment APFs and FIRs, each group on its own) cannot be written: those actions do nothing and write "read only, this part of the channel is linked to another one in RiTA" to the log. Rename still works. The API does not say which channel is the master.

**DSP: clear channel is the exception**: on a linked channel it undoes the link and then resets the channel, exactly as RiTA's own Clear button does, with no confirmation.

**DSP: clear channel** is the Clear button of the row: it also clears that engine measurement, and on a linked channel it undoes the link first.

### Feedbacks

Connected, Mute group is muted, Mute group has channels, Sync All is set, Sync All is possible, AVG on, AVG has a curve, generator running, generator signal, engine active, engine selected, DSP type is, Reference mode is, Measurement mode is, DSP polarity inverted, DSP alignment APF enabled.

### Variables

- `$(rita:generator_running)`, `generator_signal`, `generator_gain`, `generator_duration`, `generator_output1`, `generator_output2`
- `$(rita:settings_fft_size)`, `settings_window`, `settings_smoothing`, `settings_spectrum_averages`, `settings_averaging`, `settings_sum`, `settings_coherence_threshold`, `settings_dsp_type`, `settings_dsp_model`, `settings_dsp_mode`, `settings_fft_size_auto`, `settings_engine_samples`, `settings_time_constant`, `settings_sample_rate`, `settings_reference_mode`, `settings_measurement_mode`
- `$(rita:sync_active)`, `sync_count`, `sync_possible`
- `$(rita:mute_group_N_name)`, `mute_group_N_muted`, `mute_group_N_available` for N = 1..4
- `$(rita:average_active)`, `average_has_data`, `average_count`, `average_engines`, `average_mode`, `average_name`
- `$(rita:dsp_N_name)`, `dsp_N_gain`, `dsp_N_delay`, `dsp_N_polarity` for N = 1..8
- `$(rita:dsp_N_apfK_enabled)`, `dsp_N_apfK_frequency`, `dsp_N_apfK_order`, `dsp_N_apfK_q` for N = 1..8 and K = 1..2
- `$(rita:meas_N_name)`, `meas_N_active`, `meas_N_delay`, `meas_N_dsp_delay`, `meas_N_level` for N = 1..8

In Companion 5 the text shown on a button is set in the button's **Style** tab, **Text** element, **Button text string**.
