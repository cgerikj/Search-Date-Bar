'use strict';

function changeElementStyle(elem, s, value) {
	if (elem) elem.style[s] = value;
}

// Sample Google's actual background instead of prefers-color-scheme; the two can disagree.
function markPageTheme() {
	var bg = getComputedStyle(document.body).backgroundColor;
	var rgb = bg.match(/\d+/g);
	if (!rgb) return;
	var luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255;
	document.documentElement.classList.toggle("sdb-dark", luminance < 0.5);
}

function getParameterByName(name, url) {
	if (!url) url = window.location.href;
	name = name.replace(/[\[\]]/g, "\\$&");
	var regex = new RegExp("[?&]" + name + "(=([^&#]*)|&|#|$)"),
		results = regex.exec(url);
	if (!results) return null;
	if (!results[2]) return '';
	return decodeURIComponent(results[2].replace(/\+/g, " "));
}

function setTbsParameter(parameter, value) {
	var href = new URL(location.href);
	href.searchParams.set("tbs", parameter + ":" + value);
	return href.toString();
}

// Tooltip/aria-label text for the abbreviated buttons (1h, 1d, ...).
var QDR_FULL_LABELS = {
	"": "Any time",
	"h": "Past hour",
	"d": "Past day",
	"w": "Past week",
	"m": "Past month",
	"m6": "Past 6 months",
	"y": "Past year",
	"y2": "Past 2 years",
	"y5": "Past 5 years",
};

function createButton(qdr, tbs, text) {
	var li = document.createElement("li");
	var fullLabel = QDR_FULL_LABELS[qdr] || text;
	var extraAttrs = fullLabel !== text ? ' title="' + fullLabel + '" aria-label="' + fullLabel + '"' : '';
	//if already selected
	if(tbs == ("qdr:"+qdr) || tbs == null && qdr == "") {
		li.innerHTML = '<h3 class="time-h3 time-h3-sel"' + extraAttrs + '>'+text+'</h3>';
		li.className = "time-li time-li-sel";
	} else { //add url href
		var newUrl = setTbsParameter("qdr", qdr);
		li.innerHTML = '<a class="q qs" href="' + newUrl + '"' + extraAttrs + '><h3 class="time-h3">'+text+'</h3></a>'
		li.className = "time-li";
	}
	li.id = "qdr_"+qdr;
	return li;
}

function toIso8601 (date) {
	if (!date) {
		return ''
	}

	const parts = date.split('/')
	let year = parts[2]

	let month = parts[0]
	if (month.length === 1) {
		month = '0' + month
	}

	let day = parts[1]
	if (day.length === 1) {
		day = '0' + day
	}

	const iso8601 = `${year}-${month}-${day}`

	return iso8601
}

function fromIso8601 (date) {
	if (!date) {
		return ''
	}

	const parts = date.split('-')
	let year = parts[0]
	let month = parts[1]
	let day = parts[2]

	return `${month}/${day}/${year}`
}

function insertNewButtons() {
	const qdrList = ["", "h", "d", "w", "m", "m6", "y", "y2", "y5"];
	const strings = ["Any time", "1h", "1d", "7d", "1m", "6m", "1y", "2y", "5y"];

	let tbs = getParameterByName("tbs");

	var newParent = document.createElement("ul");
	newParent.className = "time-ul hdtb-msb-vis";

	for(var i = 0; i < strings.length; i++) {
		newParent.appendChild(createButton(qdrList[i], tbs, strings[i]));
	}

	var customLi = document.createElement("li");
	customLi.className = "time-li time-li-range"

	let customButtonText = 'Range'
	let cd_min = '', cd_max = ''

	// Custom range selected
	if (tbs && tbs.includes('cdr:1')) {
		const tbsParts = tbs.split(",")
		
		tbsParts.forEach(part => {
			const subParts = part.split(':')
			if (subParts[0] === 'cd_min') {
				return cd_min = subParts[1]
			}
		})

		tbsParts.forEach(part => {
			const subParts = part.split(':')
			if (subParts[0] === 'cd_max') {
				return cd_max = subParts[1]
			}
		})

		// URL stays MM/DD/YYYY (Google's format); the label shows ISO 8601 since it's unambiguous across locales.
		if (cd_min && cd_max) {
			customButtonText = `${toIso8601(cd_min)} – ${toIso8601(cd_max)}`
		}

		else if (cd_min) {
			customButtonText = `After ${toIso8601(cd_min)}`
		}

		else if (cd_max) {
			customButtonText = `Before ${toIso8601(cd_max)}`
		}
	}

	// textContent/.value, not innerHTML: cd_min/cd_max come from the URL and aren't trusted.
	var customButtonHeading = document.createElement("h3");
	customButtonHeading.className = `time-h3 ${(cd_min || cd_max) ? 'time-h3-sel' : ''}`;
	customButtonHeading.textContent = customButtonText;
	customLi.appendChild(customButtonHeading);

	var customRangePopup = document.createElement("div");
	var popupInner = document.createElement("div");
	popupInner.id = "custom-range-popup";
	popupInner.setAttribute("role", "group");
	popupInner.setAttribute("aria-label", "Custom date range");

	var fromContainer = document.createElement("div");
	fromContainer.className = "custom-range-popup-container";
	var fromLabel = document.createElement("label");
	fromLabel.setAttribute("for", "custom-start");
	fromLabel.textContent = "From: ";
	var fromInput = document.createElement("input");
	fromInput.type = "date";
	fromInput.id = "custom-start";
	fromInput.name = "custom-start";
	fromInput.value = toIso8601(cd_min);
	fromInput.tabIndex = 0;
	fromContainer.append(fromLabel, fromInput);

	var toContainer = document.createElement("div");
	toContainer.className = "custom-range-popup-container";
	var toLabel = document.createElement("label");
	toLabel.setAttribute("for", "custom-end");
	toLabel.textContent = "To: ";
	var toInput = document.createElement("input");
	toInput.type = "date";
	toInput.id = "custom-end";
	toInput.name = "custom-end";
	toInput.value = toIso8601(cd_max);
	toInput.tabIndex = 1;
	toContainer.append(toLabel, toInput);

	var goButton = document.createElement("button");
	goButton.id = "custom-range-button";
	goButton.tabIndex = 2;
	goButton.textContent = "Go";

	popupInner.append(fromContainer, toContainer, goButton);
	customRangePopup.appendChild(popupInner);

	// Popup is nested in its trigger <li> for positioning, so clicks inside it
	// must not bubble up to customLi's onclick and toggle it closed.
	customRangePopup.onclick = (event) => {
		event.stopPropagation();
	}
	customLi.appendChild(customRangePopup);

	waitFor('#custom-range-button').then((elem) => {
		if (!elem) {
			return
		}
		
		elem.onclick = () => {
			const startDate = document.getElementById('custom-start').value
			const endDate = document.getElementById('custom-end').value

			var href = new URL(location.href);
			const params =  ['cdr:1']
			if (startDate) {
				params.push(`cd_min:${fromIso8601(startDate)}`)
			}
			if (endDate) {
				params.push(`cd_max:${fromIso8601(endDate)}`)
			}
			const query = params.join(',')
			href.searchParams.set("tbs", query);
			const newUrl = href.toString();
			window.location.href = newUrl
		}
	})

	// The quick-filter buttons are <a> links and get keyboard/AT support for free; this needs it explicitly.
	customLi.tabIndex = 0;
	customLi.setAttribute("role", "button");
	customLi.setAttribute("aria-haspopup", "true");
	customLi.setAttribute("aria-expanded", "false");
	customLi.setAttribute("aria-controls", "custom-range-popup");

	const toggleCustomRangePopup = () => {
		const currentCustomRangePopup = document.getElementById('custom-range-popup')
		const isOpen = currentCustomRangePopup.style.display === 'flex'

		currentCustomRangePopup.style.display = isOpen ? 'none' : 'flex'
		customLi.setAttribute("aria-expanded", isOpen ? "false" : "true")
	}
	customLi.onclick = toggleCustomRangePopup;
	customLi.onkeydown = (event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			toggleCustomRangePopup();
		}
	}
	newParent.appendChild(customLi);

	// Result count is left out; it's already in Google's own Tools/Verktyg menu.
	var verbatim = document.createElement("li");
	verbatim.style.marginLeft = "auto"; // push to row end; it's a flex row, so float doesn't work

	var verbatimTitle = "Search using your exact words, without spelling correction or synonyms";

	if(tbs == "li:1") {
		var newUrl = setTbsParameter("qdr", null);
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '" title="' + verbatimTitle + '"><h3 class="time-h3 time-h3-sel">Verbatim</h3></a>'
		verbatim.className = "time-li time-li-sel time-li-verbatim";
		verbatim.id = "li_1";
	} else { //verbatim not selected
		var newUrl = setTbsParameter("li", 1);
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '" title="' + verbatimTitle + '"><h3 class="time-h3">Verbatim</h3></a>'
		verbatim.className = "time-li time-li-verbatim";
		verbatim.id = "li_";
	}
	newParent.appendChild(verbatim);

	// #appbar is a fallback if #center_col (the real results column) is ever missing.
	let referenceNode = document.getElementById("center_col") || document.getElementById("appbar");
	if (referenceNode) {
		referenceNode.prepend(newParent);
	}
}

function modifyOtherElements() {
	// Don't remove Google's spacer elements here; the bar's space is reserved separately (CLS).
	changeElementStyle(document.getElementById("botabar"), "paddingBottom", 0);
	changeElementStyle(document.getElementsByClassName("rl_feature")[0], "marginBottom", 0);
	
	changeElementStyle(document.getElementById("extabar"), "min-height", "43px");

	const hdtbMenus = document.getElementById("hdtbMenus")
	if (hdtbMenus) {
		hdtbMenus.style['backgroundColor'] = 'white';
		hdtbMenus.style['paddingBottom'] = '9px';
	}
}

// Some verticals (e.g. Images) now use udm instead of tbm.
const isSpecialPage = ["vid", "isch", "nws", "shop", "fin"].includes(getParameterByName("tbm"))
	|| !!getParameterByName("udm");

// Reserve space before Google's first paint (see styles.css) so inserting the bar later causes zero layout shift.
if (!isSpecialPage) {
	document.documentElement.classList.add("sdb-reserve-space");
}

function load() {
	switch(true) {
		case isSpecialPage:
			break;

		default: //ALL page
			markPageTheme();
			insertNewButtons();
			modifyOtherElements();
			break;
	}
}

const waitFor = async selector => {
	let elem
	let i = 0
	while (true) {
		if (++i > 10) {
			return null
		}

		elem = document.querySelector(selector)
		if  (!!elem) {
			return elem
		}
		await new Promise(requestAnimationFrame)
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", load);
} else {
	load();
}