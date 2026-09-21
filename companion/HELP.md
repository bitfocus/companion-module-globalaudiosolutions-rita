## RiTA (Global Audio Solutions)

Controls RiTA through its WebSocket API (`ws://<ip>:26101/api/v1/`).

Requires a RiTA version whose API includes change events, the 20-filter EQ and Live TF. With an older RiTA the module still connects, but some actions are rejected.

### Configuration

- **RiTA IP address**: the machine running RiTA with the API enabled.
- **Control port**: 26101 by default. RiTA serves one client per port, so the module tries this port and the next four.
- **Password**: only if the API password is enabled in RiTA. If it is changed in RiTA while connected, the module logs in again on its own (within 30 s). A wrong password is not retried until the configuration is saved again, because RiTA locks the connection after 5 attempts.
- **Level meter poll interval**: RiTA sends an event whenever something the module shows changes, except the engine level meters, which are read at this interval. On an older RiTA without events, everything is read at this interval.

### Actions

- **Generator**: Spectrum / Live TF on/off, pink noise on/off (Live TF), signal, gain, duration, outputs.
- **Settings**: FFT size, window, smoothing, spectrum averages, averaging, sum, plot style, coherence threshold.
- **Measurement**: capture, activate engine, find delay, set delay, set inputs, rename, export all.
- **Memory**: store the trace of an engine, show/hide, rename, delete.
- **AVG**: on/off, export impulse.
- **DSP**: channel gain (absolute or step), delay, polarity, name, clear, EQ filter (1-20) and its on/off, alignment APF (1-2) and its on/off, high-pass and low-pass.
- **Advanced: send API command**: any request with a JSON properties field, for objects not covered above.

**Capture** measures on an engine with the current signal, and turns the engine on:
- With Sweep, Multi Sweep, Pink or External it measures once. RiTA does not answer anything while it measures; the module waits for the estimated duration and then writes the result (or the error RiTA reports) to the log.
- With Spectrum or Live TF it starts measuring continuously on that engine (or adds the engine if it is already running) until the generator is stopped. RiTA keeps answering while it runs.

**Spectrum / Live TF on/off** selects the chosen signal if needed and measures it on the chosen engine; off stops it. Spectrum can run on several engines (deactivate one with **Measurement: activate engine**); Live TF measures one engine at a time, so turning an engine on turns the others off.

**Pink noise on/off** plays pink noise through the generator outputs while Live TF runs. Live TF itself generates nothing.

**Measurement: find delay** with Live TF running starts a search on the active engine; after a few seconds the module reads the delay found and writes it to the log. Another find delay while it searches answers busy.

**Measurement: set inputs** sets the measurement input of that engine only. In 1 Ref. Channel mode the reference input goes to all eight engines.

**EQ filters** start disabled in RiTA: a filter that is not enabled is stored but does not sound. Gain applies to Parametric and the shelving types, order to APF and FIR RevPhase.

**Alignment APFs** are the 2 all-pass filters per channel that RiTA's Auto Align writes (it replaces both on every run), separate from the 20 EQ filters. They can also be set by hand: frequency, order (1 or 2) and Q. The module follows them, so buttons update after an Auto Align. Older RiTA versions do not have them.

**AVG** is RiTA's average of the **selected** engines (not the active ones). **AVG: on / off** is the same control as *Settings: averaging on/off*. **AVG: export impulse** writes the impulse response of the average to the Memory Bank folder, in the format chosen in RiTA; the export runs in the background and its result (or error, such as no export folder or AVG off) is written to the log.

**Measurement: export all** is RiTA's Export All: it exports the **selected** engines (the engine buttons, `selected` in the API) to the project folder, in the format chosen in RiTA. If a Position is written in RiTA, each file is named `<engine>_<position>` (and the AVG export gets `_<position>` too). The export runs in the background; its result (or error, such as no engine selected or no export folder) is written to the log.

**DSP: clear channel** is the Clear button of the row, and also clears that engine measurement.

### Feedbacks

Connected, AVG on, AVG has a curve, generator running, generator pink noise, generator signal, engine active, engine selected, DSP polarity inverted, DSP alignment APF enabled.

### Variables

- `$(rita:generator_running)`, `generator_signal`, `generator_gain`, `generator_duration`, `generator_output1`, `generator_output2`, `generator_pink_noise`
- `$(rita:average_active)`, `average_has_data`, `average_count`, `average_engines`, `average_mode`, `average_name`
- `$(rita:dsp_N_name)`, `dsp_N_gain`, `dsp_N_delay`, `dsp_N_polarity` for N = 1..8
- `$(rita:dsp_N_apfK_enabled)`, `dsp_N_apfK_frequency`, `dsp_N_apfK_order`, `dsp_N_apfK_q` for N = 1..8 and K = 1..2
- `$(rita:meas_N_name)`, `meas_N_active`, `meas_N_delay`, `meas_N_level` for N = 1..8

In Companion 5 the text shown on a button is set in the button's **Style** tab, **Text** element, **Button text string**.
