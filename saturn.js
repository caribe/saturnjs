"use strict";

var sj = new function(endpoint) {

	this.setEndpoint = function(url) { endpoint = url };
	this.setRequestWait = function(callback) { onRequestWait = callback };
	this.setRequestComplete = function(callback) { setRequestComplete = callback };
	this.setClickCallback = function(callback) { onClickCallback = callback };
	this.setErrorCallback = function(callback) { onErrorCallback = callback };
	this.setActionCallback = function(callback) { onActionCallback = callback };
	this.setBeforeRequestCallback = function(callback) { onBeforeRequestCallback = callback };

	// Render function
	function renderSingle(el, k, v) {
		if (!loaded || !el) return;
		var list = k == "_" ? [el] : el.querySelectorAll("[name="+k+"]");
		if (!list.length) return console.error("Element not found", el, k, v);
		if (typeof v == "string" || typeof v == "number") v = { _: v };
		else if (typeof v == "boolean") v = { hidden: !v };

		for (var i in v) {
			for (j = 0; j < list.length; j++) {
				var l = list[j];
				if (i == "_") {
					if (l.tagName == "INPUT" && l.type == "radio") {
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
			if (onSubmitCallback) onErrorCallback(json);
			else console.error(json);
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

		this.action = function(q) {
			sj.request(q);
		},

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

	function containerClass(id, start, obj) {
		this.current = start;
		this.onChange = function(current) {}

		this.set = function(id) {
			this.current = id;
			for (var i = 0; i < this.el.children.length; i++) {
				var el = this.el.children[i];
				if (el.hasAttribute("data-component")) {
					sj.$(el.id).visible(el.id == id);
				}
			}
			this.onChange(this.current);
		}

		this.get = function() {
			return this.current;
		}

		this.el = document.getElementById(id);
		if (!this.el) throw "Container `"+id+"` not found";
		this.el.setAttribute("data-container", "");

		for (var i = 0; i < this.el.children.length; i++) {
			var el = this.el.children[i];
			sj.$(el.id).visible(el.id == start);
		}

		if (obj) for (var i in obj) {
			this[i] = obj[i];
		}
	}

	this.container = function(id, start, obj) {
		containers[id] = [start, obj];
		if (loaded) {
			containers[id] = new containerClass(id, start, obj);
		}
	}

	this.$ = function(id) {
		if (components[id]) {
			return components[id];
		} else if (containers[id]) {
			return containers[id];
		} else {
			console.error("`"+id+"` not found");
		}
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
				sj.request(target.hash);
				ev.preventDefault();
			} else if (target.hash.search(/^#!/) > -1) {
				components[id].onaction(target.hash.substring(2), target);
				ev.preventDefault();
			}
		} else if (target.tagName == "FORM" && ev.type == 'submit') {
			if (target.action.search(/#\?/) > -1) {
				components[id].onrequest(ev, target);
				sj.request(target.action, target);
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

	this.request = function(query, form) {
		if (!endpoint) throw "No endpoint defined!";
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("load", function(ev) {
			var json = JSON.parse(ev.target.responseText);
			if (json.error) {
				components[json.component].onerror(json);
			} else if (json.component && components[json.component]) {
				components[json.component].onresponse(json);
			} else {
				throw "Component `"+json.component+"` not found";
			}
			if (onRequestComplete) onRequestComplete();
			sj.removeClass(document.body, "wait");
		}, false);
		xhr.addEventListener("error", function(ev) {
			console.error(ev.message, ev);
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

		if (onRequestWait) onRequestWait();
	}

	var loaded = false;
	var endpoint = null;
	var components = {};
	var containers = {};

	var onBeforeRequestCallback = null;
	var onRequestWait = null;
	var onRequestComplete = null;

	var onActionCallback = null;
	var onClickCallback = null;
	var onSubmitCallback = null;
	var onErrorCallback = null;

	document.addEventListener('DOMContentLoaded', function() {
		document.body.addEventListener("click", onaction, false);
		document.body.addEventListener("submit", onaction, false);

		loaded = true;
		for (var i in components) {
			sj.component(i, components[i]);
		}
		for (var i in containers) {
			sj.container(i, containers[i][0], containers[i][1]);
		}

		var event = document.createEvent('Event');
		event.initEvent('SjStarted', true, true);
		document.dispatchEvent(event);
	}, false);
};
