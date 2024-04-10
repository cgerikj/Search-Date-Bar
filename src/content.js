'use strict';

// thx https://stackoverflow.com/a/40724354/2407063
var SI_SYMBOL = ["", "k", "M", "G", "T", "P", "E"];
function abbreviateNumber(number){

    // what tier? (determines SI symbol)
    var tier = Math.log10(number) / 3 | 0;

    // if zero, we don't need a suffix
    if(tier == 0) return number;

    // get suffix and determine scale
    var suffix = SI_SYMBOL[tier];
    var scale = Math.pow(10, tier * 3);

    // scale the number
    var scaled = number / scale;

    // format number and add suffix
    return scaled.toFixed(1) + suffix;
}

function getResultsAmount(resultsString) {
	resultsString = resultsString.replace(/\s|\.|\,/g, "");
	let foundFirstNum = false;
	let numString = "";
	for (let char of resultsString) {
		if (!isNaN(char)) {
			numString += char;
			foundFirstNum = true;
		} else {
			if (foundFirstNum) {
				return abbreviateNumber(numString);
			}
		}
	}
}

function removeElement(id) {
	var elem = document.getElementById(id);
	if (elem) elem.parentNode.removeChild(elem);
}

function changeElementStyle(elem, s, value) {
	if (elem) elem.style[s] = value;
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

function createButton(qdr, tbs, text) {
	var li = document.createElement("li");
	//if already selected
	if(tbs == ("qdr:"+qdr) || tbs == null && qdr == "") {
		li.innerHTML = '<h3 class="time-h3 time-h3-sel">'+text+'</h3>';
		li.className = "time-li time-li-sel";
	} else { //add url href
		var newUrl = setTbsParameter("qdr", qdr);
		li.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3">'+text+'</h3></a>'
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
	const strings = ["ANY", "1H", "1D", "7D", "1M", "6M", "1Y", "2Y", "5Y"];

	let tbs = getParameterByName("tbs");

	var newParent = document.createElement("ul");
	newParent.className = "time-ul hdtb-msb-vis";

	// Add all time buttons to the parent ul
	for(var i = 0; i < strings.length; i++) {
		newParent.appendChild(createButton(qdrList[i], tbs, strings[i]));
	}

	// Add custom range button
	var customLi = document.createElement("li");
	customLi.className = "time-li"

	let customButtonText = 'RANGE'
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

		if (cd_min && cd_max) {
			customButtonText = `${cd_min} - ${cd_max}`
		}

		else if (cd_min) {
			customButtonText = `After ${cd_min}`
		}
		
		else if (cd_max) {
			customButtonText = `Before ${cd_max}`
		}
	}
	customLi.innerHTML = `<h3 class="time-h3 ${(cd_min || cd_max) ? 'time-h3-sel' : ''}">${customButtonText}</h3>`

	var customRangePopup = document.createElement("div");
	let cd_min_iso8601 = toIso8601(cd_min)
	let cd_max_iso8601 = toIso8601(cd_max)
	customRangePopup.innerHTML = `<div id="custom-range-popup"> <div class="custom-range-popup-container"><label for="custom-start">From: </label><input type="date" id="custom-start" name="custom-start" value="${cd_min_iso8601}" tabindex="0"/></div> <div class="custom-range-popup-container" ><label for="custom-end">To: </label><input type="date" id="custom-end" name="custom-end" value="${cd_max_iso8601}" tabindex="1"/></div> <button id="custom-range-button" role="button" tabindex="2">Go</button> </div>`
	
	newParent.appendChild(customRangePopup);

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

	customLi.onclick = () => {
		const currentCustomRangePopup =  document.getElementById('custom-range-popup')

		if (currentCustomRangePopup.style.display !== 'flex') {
			currentCustomRangePopup.style.display = 'flex'
		} else {
			currentCustomRangePopup.style.display = 'none'
		}
	}
	newParent.appendChild(customLi);

	// Add Verbatim button
	var verbatim = document.createElement("li");
	verbatim.style.cssFloat = "right";
	verbatim.style.marginLeft = "10px";

	// If verbatim selected
	if(tbs == "li:1") {
		var newUrl = setTbsParameter("qdr", null);
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3 time-h3-sel">Verbatim</h3></a>'
		verbatim.className = "time-li time-li-sel";
		verbatim.id = "li_1";
	} else { //verbatim not selected
		var newUrl = setTbsParameter("li", 1);
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3">Verbatim</h3></a>'
		verbatim.className = "time-li";
		verbatim.id = "li_";
	}
	newParent.appendChild(verbatim);


	var resultStats = document.getElementById("result-stats");
	if (resultStats) {
		resultStats.id = "new-resultstats";
		resultStats.style.float = "right";
		resultStats.style.marginRight = "16px";
		resultStats.style.paddingTop = "2px";
		resultStats.style.color = "rgb(119, 119, 119)";
		resultStats.setAttribute('title', resultStats.innerText);
		resultStats.innerText = `~ ${getResultsAmount(resultStats.innerText)}`;
		newParent.appendChild(resultStats);
	}

	let referenceNode = document.getElementById("appbar");
	if (referenceNode) {
		referenceNode.prepend(newParent);
	}
}

function modifyOtherElements() {
	removeElement("slim_appbar");
	changeElementStyle(document.getElementById("botabar"), "paddingBottom", 0);
	changeElementStyle(document.getElementsByClassName("rl_feature")[0], "marginBottom", 0);
	
	changeElementStyle(document.getElementById("extabar"), "min-height", "43px");

	const hdtbMenus = document.getElementById("hdtbMenus")
	if (hdtbMenus) {
		hdtbMenus.style['backgroundColor'] = 'white';
		hdtbMenus.style['paddingBottom'] = '9px';
	}
}

function load() {
	switch(getParameterByName("tbm")) {
		case "vid": //Videos page
		case "isch": //Images page
		case "nws": //News page
		case "shop": //Shopping page
		case "fin": //Finance page
			// changeElementStyle(document.getElementById("hdtb-tls"), "display", "inline-block");
			// changeElementStyle(document.getElementById("hdtbMenus"), "display", "block");
			break;

		default: //ALL page
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

waitFor('#result-stats')
load()