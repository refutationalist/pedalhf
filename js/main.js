var radio;

document.addEventListener("DOMContentLoaded", async function() {
	let start_scan = false;
	let increment = 0.001;
	let scan_interval = 1000;
	let current_band;
	let current_freq;
	let bands;

	/* STEP 1: Define Elements */

	let debug_e = {
		box:   document.querySelector("#debug"),
		close: document.querySelector("#debug_close"),
		freq:  document.querySelector("#d_freq"),
		mode:  document.querySelector("#d_mode"),
		ptt:   document.querySelector("#d_ptt"),
		meter: document.querySelector("#d_meter"),
		err:   document.querySelector("#d_error"),
		wait:  document.querySelector("#d_wait"),
	};

	let display_e = {
		plate:   document.querySelector("#plate"),
		mode:    document.querySelector("#mode"),
		freq:    document.querySelector("#freq"),
		ptt:     document.querySelector("#ptt"),
		m_type:  document.querySelector("#m_type"),
		m_val:   document.querySelector("#m_val"),
		status:  document.querySelector("#status"),
		label:   document.querySelector("#label"),
		waiting: document.querySelector("#waiting")
	};

	let modify_e = {
		freq: document.querySelector("#newfreq"),
		mode: document.querySelector("#setmode"),
		up:   document.querySelector("#tuneup"),
		down: document.querySelector("#tunedown"),
		scan: document.querySelector("#scan"),
		log:  document.querySelector("#openlog")
	};

	let log_e = {
		box:  document.querySelector("#logger"),
		call: document.querySelector("#call"),
		rsts: document.querySelector("#rsts"),
		rstr: document.querySelector("#rstr"),
		note: document.querySelector("#note"),
		freq: document.querySelector("#log_freq"),
		mode: document.querySelector("#log_mode"),
		go:   document.querySelector("#log_submit"),
		reset: document.querySelector("#log_reset")
	};


	// STEP 2: Helper functions (mostly for logging)
	
	async function log_reset() {
		log_e.box.style.display = "none";

		log_e.freq.innerHTML = null;
		log_e.mode.innerHTML = null;

		log_e.call.value = null;
		log_e.note.value = null;
		log_e.rsts.value = null;
		log_e.rstr.value = null;
	}

	async function log_submit() {

		let log = new FormData();

		log.set("time", new Date().toISOString());
		log.set("call", log_e.call.value.trim());
		log.set("note", log_e.note.value.trim());
		log.set("freq", log_e.freq.innerHTML);
		log.set("mode", log_e.mode.innerHTML);
		log.set("rstr", parseInt(log_e.rstr.value));
		log.set("rsts", parseInt(log_e.rsts.value));


		let result = await fetch(
			"log.php",
			{
				method: "POST",
				body: log
			}
		).then( (r) => {
			return r.json();
		});

		if (result[0] == false) {
			alert(`Log failed on POST: ${result[1]}`);
		} else {
			log_reset();
		}


	}



	/* STEP 3: Bind to UI */

	// Change Frequency 
	display_e.freq.addEventListener("click", function() {
		modify_e.freq.style.display = "block";
		modify_e.freq.focus();
	});
	modify_e.freq.addEventListener("keyup", (evt) => {
		if (evt.key === "Enter") {
			let f = parseFloat(modify_e.freq.value);
			if (!isNaN(f)) {
				if (radio.scanning) radio.unscan();
				radio.freq = f;
			}
			modify_e.freq.style.display = "none";
			modify_e.freq.value = null;
		}
	});

	// Change Mode
	modify_e.mode.addEventListener("change", (evt) => {
		let m = evt.target.children[ evt.target.selectedIndex ].value.trim();
		radio.mode = m;
	});



	// Tune up
	modify_e.up.addEventListener("click", (evt) => {
		if (start_scan) {
			radio.scan(increment, scan_interval);
		} else {
			radio.freq = radio.freq + increment;
		}
		start_scan = false;
		
	});

	// Tune down
	modify_e.down.addEventListener("click", (evt) => {
		if (start_scan) {
			radio.scan(-increment, scan_interval);
		} else {
			radio.freq = radio.freq - increment;
		}
		start_scan = false;
		
	});

	// Scan mode toggle
	modify_e.scan.addEventListener("click", (evt) => {
		start_scan = !start_scan;
		
		if (radio.scanning) {
			radio.unscan();
			// button handling will happen in event
		} else if (start_scan == true) {
			evt.target.classList.add("pressed");
		} else {
			evt.target.classList.remove("pressed");
		}

	});

	// PTT click triggers debug
	display_e.ptt.addEventListener("click", (evt) => {
		debug_e.box.style.display = "block";
	});
	// so does a click on the waiting overlay.
	display_e.waiting.addEventListener("click", (evt) => {
		debug_e.box.style.display = "block";
	});
	// Close debug
	debug_e.close.addEventListener("click", (evt) => {
		debug_e.box.style.display = "none";
	});


	// Open Logger
	modify_e.log.addEventListener("click", (evt) => {
		log_e.box.style.display = "block";
		log_e.freq.innerHTML = radio.freq.toFixed(5);
		log_e.mode.innerHTML = radio.mode;
	});

	// Logger window handling

	// reset and close log
	log_e.reset.addEventListener("click", (evt) => {
		log_reset();
	});

	log_e.go.addEventListener("click", (evt) => {

		if (log_e.call.value.trim() == "") {
			alert("Logger needs a call at the minimum.");
			return;
		}
		log_submit();

	});


	/* STEP 4: Bind to events */

	window.addEventListener("radioScan", (evt) => {
		start_scan = false;

		if (evt.detail.scanning) {
			modify_e.scan.classList.add("pressed");
			display_e.status.style.visibility = "visible";
		} else {
			modify_e.scan.classList.remove("pressed");
			display_e.status.style.visibility = "hidden";
		}
	});
	


	// Freq from Radio
	window.addEventListener("radioFreq", (evt) => {
		debug_e.freq.innerHTML = evt.detail.freq;

		let f = evt.detail.freq;

		if (f != current_freq) {
			current_freq = f;
			let t = `${f.toFixed(5)}`;
			let found = null;

			display_e.freq.innerHTML = 
				'<span>' + 
				t.slice(0, t.length - 2) +
				'</span><span>' +
				t.slice(-2) +
				'</span>';

			for (const x in bands) {
				if (f >= bands[x].low && f <= bands[x].high) {
					found = x;
					break;
				} 
			}

			if (found != current_band) {

				if (found == null) {
					display_e.label.innerHTML = '';
					display_e.label.style.background = '';
					display_e.label.style.color = '';
				} else {
					display_e.label.style.background = bands[found].bg;
					display_e.label.style.color = bands[found].fg;
					display_e.label.innerHTML = bands[found].label;
				}

				current_band = found;

			}
		}

	});


	// PTT from Radio
	window.addEventListener("radioPTT", (evt) => {
		debug_e.ptt.innerHTML = evt.detail.ptt;

		if (evt.detail.ptt) {
			display_e.plate.classList.add("tx");
			display_e.plate.classList.remove("rx");
			display_e.ptt.innerHTML = "TX";
		} else {
			display_e.plate.classList.add("rx");
			display_e.plate.classList.remove("tx");
			display_e.ptt.innerHTML = "RX";
		}

	});


	// Meter From Radio
	window.addEventListener("radioMeter", (evt) => {
		let x = evt.detail.meter;
		debug_e.meter.innerHTML = `${x[0]} ${x[1]}`;

		display_e.m_val.innerHTML = Math.round(parseFloat(x[1]) * 100) / 100;
		if (x[0] == "strength") {
			display_e.m_type.innerHTML = "STR:";
		} else if (x[0] == "swr") {
			display_e.m_type.innerHTML = "SWR:";
		} else {
			display_e.m_type.innerHTML = "UNK:";
		}
	});


	// Mode From Radio
	window.addEventListener("radioMode", (evt) => {
		let m = evt.detail.mode;
		debug_e.mode.innerHTML = display_e.mode.innerHTML = m;
		modify_e.mode.value = m;
	});


	// Error From Radio
	window.addEventListener("radioError", (evt) => {
		debug_e.err.innerHTML = evt.detail.error;
		alert(`Error: ${evt.detail.error}`);
	});


	// Wait event from Radio
	window.addEventListener("radioWait", (evt) => {
		let x = evt.detail.waiting;
		debug_e.wait.innerHTML = x;
		display_e.waiting.style.display = (x) ? "block" : "none";
	});


	/* STEP 5: LAUNCH! */

	try {
		bands = await fetch("js/bands.json").then((r) => { return r.json(); });
	} catch (error) {
		bands = [];
	}

	try {
		let php_enable = await fetch("log.php?enable=1").then((r) => { return r.json(); });
		modify_e.log.style.visibility = "visible";
	} catch (error) {
		console.error("logger unavailable", error);
	}

	radio = new rigctl({debug: false, showio: false});
	



});


