## RiTA (Global Audio Solutions)

Controls RiTA through its WebSocket API (`ws://<ip>:26101/api/v1/`).

### Configuration

- **RiTA IP address**: the machine running RiTA with the API enabled.
- **Control port**: 26101 by default. RiTA serves one client per port, so the module tries this port and the next four.
- **Password**: only if the API password is enabled in RiTA.
- **Status poll interval**: RiTA does not push changes, so the generator, the 8 DSP channels and the 8 measurement engines are read at this interval to keep feedbacks and variables up to date. Set 0 to disable polling (actions still work, toggles and "adjust gain" will not).

### Actions

- **Generator**: signal, gain, sweep duration, outputs.
- **Settings**: FFT size, window, smoothing, spectrum averages, averaging, sum, plot style, coherence threshold.
- **Measurement**: capture, activate engine, find delay, set delay, set inputs, rename.

**Capture** is how a measurement is started: it turns the engine on, prepares the current generator signal and runs it. It is rejected (`unknown value`) with Spectrum or TF selected, and with M-Noise at 44.1/48 kHz. Polling pauses for the estimated duration, then the result (or the error RiTA reports) is written to the module log.
- **Memory**: store the trace of an engine, show/hide, rename, delete.
- **DSP**: channel gain (absolute or step), delay, polarity, name, parametric EQ, high-pass and low-pass.
- **Advanced: send API command**: any `get`/`set`/`capture`/`delete`/`findDelay` with a JSON properties field, for objects not covered above.

While a capture is running RiTA does not answer other requests; commands sent meanwhile are delayed until it finishes.

### Feedbacks

Connected, generator running, generator signal, engine active, engine selected, DSP polarity inverted.

### Variables

- `$(rita:generator_running)`, `generator_signal`, `generator_gain`, `generator_duration`, `generator_output1`, `generator_output2`
- `$(rita:dsp_N_name)`, `dsp_N_gain`, `dsp_N_delay`, `dsp_N_polarity` for N = 1..8
- `$(rita:meas_N_name)`, `meas_N_active`, `meas_N_delay`, `meas_N_level` for N = 1..8
