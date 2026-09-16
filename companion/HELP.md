## RiTA (Global Audio Solutions)

Controls RiTA through its WebSocket API (`ws://<ip>:26101/api/v1/`).

### Configuration

- **RiTA IP address**: the machine running RiTA with the API enabled.
- **Control port**: 26101 by default. RiTA serves one client per port, so the module tries this port and the next four.
- **Password**: only if the API password is enabled in RiTA. If it is changed in RiTA while connected, the module logs in again on its own (within 30 s). A wrong password is not retried until the configuration is saved again, because RiTA locks the connection after 5 attempts.
- **Level meter poll interval**: RiTA sends an event whenever something the module shows changes, except the engine level meters, which are read at this interval. On an older RiTA without events, everything is read at this interval.

### Actions

- **Generator**: Spectrum / Live TF on/off, signal, gain, duration, outputs.
- **Settings**: FFT size, window, smoothing, spectrum averages, averaging, sum, plot style, coherence threshold.
- **Measurement**: capture, activate engine, find delay, set delay, set inputs, rename.
- **Memory**: store the trace of an engine, show/hide, rename, delete.
- **DSP**: channel gain (absolute or step), delay, polarity, name, clear, EQ filter (1-20) and its on/off, high-pass and low-pass.
- **Advanced: send API command**: any request with a JSON properties field, for objects not covered above.

**Capture** measures on an engine with the current signal, and turns the engine on:
- With Sweep, Multi Sweep, Pink or External it measures once. RiTA does not answer anything while it measures; the module waits for the estimated duration and then writes the result (or the error RiTA reports) to the log.
- With Spectrum or Live TF it starts measuring continuously on that engine (or adds the engine if it is already running) until the generator is stopped. RiTA keeps answering while it runs.

**Spectrum / Live TF on/off** selects the chosen signal if needed and measures it on the chosen engine; off stops it on every engine. To remove a single engine, deactivate it with **Measurement: activate engine**.

**Measurement: set inputs** sets the measurement input of that engine only. In 1 Ref. Channel mode the reference input goes to all eight engines.

**EQ filters** start disabled in RiTA: a filter that is not enabled is stored but does not sound. Gain applies to Parametric and the shelving types, order to APF and FIR RevPhase.

**DSP: clear channel** is the Clear button of the row, and also clears that engine measurement.

### Feedbacks

Connected, generator running, generator signal, engine active, engine selected, DSP polarity inverted.

### Variables

- `$(rita:generator_running)`, `generator_signal`, `generator_gain`, `generator_duration`, `generator_output1`, `generator_output2`
- `$(rita:dsp_N_name)`, `dsp_N_gain`, `dsp_N_delay`, `dsp_N_polarity` for N = 1..8
- `$(rita:meas_N_name)`, `meas_N_active`, `meas_N_delay`, `meas_N_level` for N = 1..8

In Companion 5 the text shown on a button is set in the button's **Style** tab, **Text** element, **Button text string**.
