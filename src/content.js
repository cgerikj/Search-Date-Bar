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

function addTbsParameter(parameter, value) {
	var href = new URL(location.href);
	if(!value) {
		href.searchParams.delete("tbs");
		return href.toString();
	}

	var tbs = getParameterByName("tbs");
	if(tbs && tbs.includes(",")) {
		let split = tbs.split(",");
		switch(parameter) {
			case "qdr":
				href.searchParams.set("tbs", "qdr:" + value + "," + split[1]);
				break;

			case "li":
				href.searchParams.set("tbs", "li:" + value);
				break; 
		}
	} else {
		if(parameter == "sbd") {
			href.searchParams.set("tbs", tbs + "," + "sbd:" + value);
		} else {
			href.searchParams.set("tbs", parameter + ":" + value);
		}
	}
	return href.toString();
}

function createButton(qdr, tbs, text) {
	var li = document.createElement("li");
	//if already selected
	if(tbs == ("qdr:"+qdr) || tbs == null && qdr == "") {
		li.innerHTML = '<h3 class="time-h3-sel">'+text+'</h3>';
		li.className = "time-li time-li-sel";
	} else { //add url href
		var newUrl = addTbsParameter("qdr", qdr);
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
	let sbd = null;
	if(tbs && tbs.includes("sbd:1")) {
		let part1 = tbs.split(",")[0];
		let part2 = tbs.split(",")[1];
		if(part1.includes("qdr")) { //qdr and sbd can come in different orders..
			tbs = part1;
			sbd = part2;
		} else {
			tbs = part2;
			sbd = part1;
		}
	}

	var newParent = document.createElement("ul");
	newParent.className = "time-ul hdtb-msb-vis";

	//add all time buttons to the parent ul
	for(var i = 0; i < strings.length; i++) {
		newParent.appendChild(createButton(qdrList[i], tbs, strings[i]));
	}

	//add Verbatim button
	var verbatim = document.createElement("li");
	verbatim.style.cssFloat = "right";
	verbatim.style.marginLeft = "10px";
	//if verbatim selected
	if(tbs == "li:1") {
		var newUrl = addTbsParameter("qdr", null);
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3-sel">Verbatim</h3></a>'
		verbatim.className = "time-li time-li-sel";
		verbatim.id = "li_1";
	} else { //verbatim not selected
		var newUrl = addTbsParameter("li", 1);
		verbatim.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3">Verbatim</h3></a>'
		verbatim.className = "time-li";
		verbatim.id = "li_";
	}
	newParent.appendChild(verbatim);

	//add search by date button
	if(tbs && tbs.includes("qdr")) {
		var searchByDate = document.createElement("li");
		searchByDate.style.cssFloat = "right";
		//sbd selected
		if (sbd) {
			var newUrl = addTbsParameter("qdr", null);
			searchByDate.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3-sel">By Date</h3></a>'
			searchByDate.className = "time-li time-li-sel";
			searchByDate.id = "sbd_1";
		} else { //sbd not selected
			var newUrl = addTbsParameter("sbd", 1);
			searchByDate.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="time-h3">By Date</h3></a>'
			searchByDate.className = "time-li";
			searchByDate.id = "sbd_";
		}
		newParent.appendChild(searchByDate);
	}

	
	var resultStats = document.getElementById("result-stats");
	if (resultStats) {
		resultStats.id = "whyareyoureadingthismess";
		resultStats.style.float = "right";
		resultStats.style.marginRight = "16px";
		resultStats.style.paddingTop = "1px";
		resultStats.style.color = "rgb(119, 119, 119)";
		resultStats.setAttribute('title', resultStats.innerText);
		resultStats.innerText = `~ ${getResultsAmount(resultStats.innerText)}`;
		newParent.appendChild(resultStats);
	}

	let referenceNode = document.getElementById("extabar");
	if (referenceNode) {
		referenceNode.prepend(newParent);
	}
}

function modifyOtherElements() {
	removeElement("slim_appbar");
	changeElementStyle(document.getElementById("botabar"), "paddingBottom", 0);
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
			insertNewButtons();
			modifyOtherElements();
			break;
	}
}