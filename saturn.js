"use strict";

// TODO Container widget

var sj = new function(endpoint) {

	this.setEndpoint = function(url) {
		endpoint = url;
	}

	// Render function
	function renderSingle(el, k, v) {
		if (!loaded || !el) return;
		var list = k == "_" ? [el] : el.querySelectorAll("[name="+k+"]");
		if (!list.length) return console.error("Element not found", el, k, v)

		if (typeof v == "string" || typeof v == "number") v = { _: v };
		else if (typeof v == "boolean") v = { hidden: !v };

		for (var i in v) {
			for (j = 0; j < list.length; j++) {
				var l = list[j];
				if (i == "_") {
					if (l.tagName == "INPUT" && (l.type == "radio" || l.type == "checkbox")) {
						l.checked = (l.value == v[i]);
					} else if (l.tagName == "INPUT") {
						l.value = v[i];
					} else if (l.hasAttribute('data-html')) {
						l.innerHTML = v[i];
					} else {
						l.innerHTML = "";
						l.appendChild(document.createTextNode(v[i]));
					}
				} else if (i == "style") {
					for (var j in v[i]) l.style[j] = v[i][j];
				} else if (v[i] === false) {
					l.removeAttribute(i);
				} else if (v[i] === true) {
					l.setAttribute(i, "");
				} else {
					l.setAttribute((i == "className" ? "class" : i), v[i]);
				}
			}
		}
	}

	// Utilities
	this.hasClass = function(el, c) {
		return (el.className.search(/\bc\b/) > -1);
	}

	this.removeClass = function(el, c) {
		var re = new RegExp("\\b\s*"+c+"\\b");
		el.className = el.className.replace(re, '').replace(/^\s+|\s$/g, '');
	}

	this.addClass = function(el, c) {
		if (!sj.hasClass(el, c)) el.className += " "+c;
	}

	this.toggleClass = function(el, c) {
		if (sj.hasClass(el, c)) {
			sj.addClass(el, c);
		} else {
			sj.removeClass(el, c);
		}
	}

	var componentClass = function(id, obj) {

		this.oncreate = function() {}
		this.onshow = function() {}
		this.onpostshow = function() {}
		this.onprehide = function() {}
		this.onhide = function() {}
		this.onclick = function(ev, target) {}
		this.onaction = function(ev, target) {
			onActionCallback(ev, this.el, target);
		}
		this.onsubmit = function(ev, target) {
			onSubmitCallback(ev, this.el, target);
		}
		this.onrequest = function() {}
		this.onresponse = function() {}
		this.onerror = function(json) {
			onErrorCallback(json);
		}

		this.hide = function() {
			this.onprehide();
			this.el.hidden = true;
			this.onhide();
		}
		this.show = function() {
			this.onshow();
			this.el.hidden = false;
			this.onpostshow();
		}
		this.visible = function(b) {
			if (b) this.show(); else this.hide();
		}

		this.hasClass = function(c) { return hasClass(this.el, c) }
		this.removeClass = function(c) { return removeClass(this.el, c) }
		this.addClass = function(c) { return addClass(this.el, c) }
		this.toggleClass = function(c) { return toggleClass(this.el, c) }

		this.render = function(p, sub) {
			var el;
			if (!p || typeof p != "object") return;
			if (typeof sub == "string") {
				el = this.el.querySelector("[name="+sub+"]");
			} else if (typeof sub == "object") {
				var t = sub;
				while (t != document.body && t != this.el) t = t.parentNode;
				el = (t == this.el) ? t : null;
			}
			if (!el) el = this.el;
			for (var i in p) {
				var l = el.querySelector("[name="+i+"]");
				if (p[i] instanceof Array) {
					while (!l.lastElementChild.hidden) l.removeChild(l.lastElementChild);
					for (var j = 0; j < p[i].length; j++) {
						var clone = l.firstElementChild.cloneNode(true);
						clone.hidden = false;
						for (var k in p[i][j]) {
							renderSingle(clone, k, p[i][j][k]);
						}
						l.appendChild(clone);
					}
				} else {
					renderSingle(el, i, p[i]);
				}
			}
			if (this.onrender) this.onrender();
		}

		this.el = document.getElementById(id);
		if (!this.el) throw "Component `"+id+"` not found";
		this.el.setAttribute("data-component", "");
		this.loop = this.el;

		for (var i in obj) {
			if (i == "loop") obj[i] = document.getElementById(obj[i]);
			this[i] = obj[i];
		}

	}

	this.component = function(id, obj) {
		components[id] = (obj ? obj : {});
		if (loaded) {
			components[id] = new componentClass(id, obj);
			components[id].oncreate();
		}
	}

	this.$ = function(id) {
		return components[id];
	}

	function parseHash(hash) {
		var q = {};

		var n = hash.search(/#[!\?]/);
		if (n > -1) hash = hash.substring(n+2);

		var p = hash.split(/[&=]/);
		for (var i = 0; i < p.length; i+=2) q[p[i]] = (p[i+1] ? p[i+1] : null);
		return q;
	}

	function onaction(ev) {
		var el = ev.target;
		if (!el) return;
		while (!el.hasAttribute("data-component") && el != document.body) el = el.parentNode;
		if (el == document.body) return;
		var id = el.id;
		var target = ev.target;
		while (target.tagName != "A" && target.tagName != "FORM" && target != el) target = target.parentNode;
		if (target.tagName == "A") {
			if (target.hash.search(/^#\?/) > -1) {
				components[id].onrequest(ev, target);
				request(target.hash);
				ev.preventDefault();
			} else if (target.hash.search(/^#!/) > -1) {
				components[id].onaction(target.hash.substring(2), target);
				ev.preventDefault();
			}
		} else if (target.tagName == "FORM") {
			if (target.action.search(/#\?/) > -1) {
				components[id].onrequest(ev, target);
				request(target.action, target);
				ev.preventDefault();
			} else if (target.action.search(/#!/) > -1) {
				var p = target.action.search(/#!/);
				components[id].onaction(parseHash(target.action), target);
				ev.preventDefault();
			}
		} else {
			components[id].onclick(ev, target);
		}
	}

	function request(query, form, silent) {
		if (!endpoint) return console.error("No endpoint defined!");
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("load", function(ev) {
			var json = JSON.parse(ev.target.responseText);
			if (json.error) {
				components[json.module].onerror(json);
			} else if (json.module && components[json.module]) {
				components[json.module].onresponse(json);
			} else {
				console.error("Component `"+json.module+"` not found");
			}
			sj.removeClass(document.body, "wait");
		}, false);
		xhr.addEventListener("error", function(ev) {
			console.error(ev);
		}, false);

		if (typeof query == "string") query = parseHash(query);
		var q = [];
		for (var i in query) q.push(i+"="+encodeURIComponent(query[i]));
		if (onBeforeRequestCallback) onBeforeRequestCallback(q);
		var url = endpoint+"?"+q.join("&");

		if (form) {
			if (!(form instanceof FormData)) form = new FormData(form);
			xhr.open('POST', url);
			xhr.send(form);
		} else {
			xhr.open('GET', url);
			xhr.send();
		}

		if (!silent) sj.addClass(document.body, "wait");
	}

	var loaded = false;
	var endpoint = null;
	var onBeforeRequestCallback = null;
	var onClickCallback = null;
	var onSubmitCallback = null;
	var components = {};

	document.addEventListener('DOMContentLoaded', function() {
		document.body.addEventListener("click", onaction, false);
		document.body.addEventListener("submit", onaction, false);

		loaded = true;
		for (var i in components) {
			sj.component(i, components[i]);
		}

		var event = document.createEvent('Event');
		event.initEvent('SjStarted', true, true);
		document.dispatchEvent(event);
	}, false);
};
