//'use strict';

function removeElement(id) {
    var elem = document.getElementById(id);
    return elem.parentNode.removeChild(elem);
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
    var url = location.href;
    if(getParameterByName("tbs")) {
        return url.replace(/(tbs=).*?(&)/,'$1' + value + '$2');
    } else {
        return url + "&tbs=" + value;
    }
}

function createButton(qdr, text) {
    var li = document.createElement("li");

    let tbs = getParameterByName("tbs");
    //if already selected
    if(tbs == ("qdr:"+qdr)) {
        li.className = "cosmoli hdtbItm hdtbSel";
        li.innerHTML = text;
    } else { //set selected & add url
        li.className = "cosmoli hdtbItm";
        var newUrl = changeUrlParameter("qdr:"+qdr);
        li.innerHTML = '<a class="q qs" href="' + newUrl + '">'+text+'</a>'
    }
    li.id = "qdr_"+qdr;
    return li;
}

function insertNewButtons() {
    //new list element
    var newParent = document.createElement("ul");
    newParent.className = "cosmoul";

    const qdrList = ["", "h", "d", "w", "m", "m6", "y", "m24"];
    const strings = ["ALL", "60m", "24h", "7d", "30d", "6m", "12m", "24m"];
    for(i = 0; i < strings.length; i++) {
        let nextElem = createButton(qdrList[i], strings[i]);
        newParent.appendChild(nextElem);
    }

    let referenceNode = document.getElementById("hdtbSum");
    referenceNode.parentNode.insertBefore(newParent, referenceNode.nextSibling);
}

function removeElements() {
    //remove select time button
    removeElement("cdrlnk");
    //remove tools button
    removeElement("hdtb-tls");
}

window.onload = function () {
    removeElements();
    insertNewButtons();
}