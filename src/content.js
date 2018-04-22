'use strict';

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

function changeUrlParameter(value) {
	var href = new URL(location.href);
	href.searchParams.set("tbs", value);
	return href.toString();
}

function createButton(qdr, text) {
	var li = document.createElement("li");

	let tbs = getParameterByName("tbs");
	//if already selected
	if(tbs == ("qdr:"+qdr) || tbs == null && qdr == "") {
		li.innerHTML = '<h3 class="time-h3-sel">'+text+'</h3>';
		li.className = "time-li time-li-sel";
	} else { //add url href
		var newUrl = changeUrlParameter("qdr:"+qdr);
		li.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3">'+text+'</h3></a>'
		li.className = "time-li";
	}
	li.id = "qdr_"+qdr;
	return li;
}

function insertNewButtons() {
	const qdrList = ["", "h", "d", "w", "m", "m6", "y", "y2"];
	const strings = ["All", "1h", "1d", "7d", "1m", "6m", "1y", "2y"];
	let tbs = getParameterByName("tbs");
	var newParent = document.createElement("ul");
	newParent.className = "time-ul hdtb-msb-vis";

	if(tbs != null && tbs.includes("qdr:")) {
		var q = tbs.split(':')[1];
		if(!qdrList.includes(q)) {
			qdrList.push(q);
			strings.push(q);
		}
	}

	//add all time buttons to the parent ul
	for(var i = 0; i < strings.length; i++) {
		newParent.appendChild(createButton(qdrList[i], strings[i]));
	}

	//add Verbatim button
	var verbatim = document.createElement("li");
	//if verbatim selected
	if(tbs == "li:1") {
		var newUrl = changeUrlParameter("qdr:");
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3-sel">Verbatim</h3></a>'
		verbatim.className = "time-li time-li-sel";
		verbatim.id = "li_1";
	} else { //verbatim not selected
		var newUrl = changeUrlParameter("li:1");
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3">Verbatim</h3></a>'
		verbatim.className = "time-li";
		verbatim.id = "li_";
	}
	newParent.appendChild(verbatim);

	let referenceNode = document.getElementById("extabar");
	referenceNode.prepend(newParent);
}

function modifyOtherElements() {
	removeElement("resultStats");
	removeElement("topabar");
	changeElementStyle(document.getElementById("botabar"), "paddingBottom", 0);
	changeElementStyle(document.getElementById("rcnt"), "marginTop", 2);
	changeElementStyle(document.getElementsByClassName("rl_feature")[0], "marginBottom", 0);
}

window.onload = function () {
	switch(getParameterByName("tbm")) {
		case "vid": //Videos page
		case "isch": //Images page
		case "nws": //News page
		case "shop": //Shopping page
		case "fin": //Finance page
			changeElementStyle(document.getElementById("hdtb-tls"), "display", "inline-block");
			changeElementStyle(document.getElementById("hdtbMenus"), "display", "block");
			break;

		default: //ALL page
			modifyOtherElements();
			insertNewButtons();
			break;
	}
}