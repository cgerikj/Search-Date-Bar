'use strict';

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
    var href = new URL(location.href);
    /*if(getParameterByName("tbs")) {
        return url.replace(/(tbs=).*?(&)/,'$1' + value + '$2');
    } else {
        return url + "&tbs=" + value;
    }*/
    href.searchParams.set("tbs", value);
    return href.toString();
}

function createButton(qdr, text) {
    var li = document.createElement("li");

    let tbs = getParameterByName("tbs");
    //if already selected
    if(tbs == ("qdr:"+qdr) || tbs == null && qdr == "") {
        li.innerHTML = '<h3 class="cosmoh3sel">'+text+'</h3>';
        li.className = "cosmoli hdtb-mitem hdtb-msel hdtb-imb";
    } else { //add url
        var newUrl = changeUrlParameter("qdr:"+qdr);
        li.innerHTML = '<a class="q qs" href="' + newUrl + '"><h3 class="cosmoh3">'+text+'</h3></a>'
        li.className = "cosmoli hdtb-mitem hdtb-imb";
    }
    li.id = "qdr_"+qdr;
    return li;
}

function insertNewButtons() {
    //new list element
    var newParent = document.createElement("ul");
    newParent.className = "cosmoul hdtb-msb-vis";

    const qdrList = ["", "h", "d", "w", "m", "m6", "y", "y2"];
    const strings = ["ALL", "1h", "1d", "7d", "30d", "6m", "12m", "24m"];
    for(var i = 0; i < strings.length; i++) {
        newParent.appendChild(createButton(qdrList[i], strings[i]));
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
    //don't run on image search
    if(getParameterByName("tbm") != "isch") {
        removeElements();
        insertNewButtons();
    }
}