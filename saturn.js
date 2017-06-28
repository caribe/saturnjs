"use strict";

var sj = new function(endpoint) {

	// General endpoint for client-server interaction
	this.setEndpoint = function(url) { endpoint = url };
	this.setRequestWait = function(callback) { onRequestWait = callback };
	this.setRequestComplete = function(callback) { onRequestComplete = callback };
	this.setClickCallback = function(callback) { onClickCallback = callback };
	this.setRequestError = function(callback) { onRequestError = callback };
	this.setBeforeAction = function(callback) { onBeforeAction = callback };
	this.setDefaultAction = function(callback) { onDefaultAction = callback };
	this.setFallbackAction = function(callback) { onFallbackAction = callback };
	this.setBeforeRequest = function(callback) { onBeforeRequest = callback };

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
				} else if (i == "visible") {
					l.hidden = !v[i];
				} else if (i == "hidden") {
					l.hidden = v[i];
				} else if (i == "className") {
					l.className = v[i];
				} else if (v[i] === false) {
					l.removeAttribute(i);
				} else if (v[i] === true) {
					l.setAttribute(i, "");
				} else {
					l.setAttribute(i, v[i]);
				}
			}
		}
	}

	var componentClass = function(id, obj) {

		this.oncreate = function() {}
		this.onshow = function() {}
		this.onpostshow = function() {}
		this.onprehide = function() {}
		this.onhide = function() {}
		this.onclick = function(ev, target) { onClickCallback(ev, this.el, target) }
		this.onaction = function(action, target) { return onDefaultAction(action, target, this); }
		this.onsubmit = function(ev, target) { onSubmitCallback(ev, this.el, target) }
		this.onrequest = function() {}
		this.onresponse = function() {}
		this.onerror = function(json) { onRequestError(json) }

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
				var l = (i == "_" ? el : el.querySelector("[name="+i+"]"));
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

		this.id = id;
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
		if (!el || el.hasAttribute("target")) return;
		while (el && !el.hasAttribute("data-component") && el != document.body) el = el.parentNode;
		if (!el || el == document.body) {
			onFallbackAction(el);
			return;
		}
		var id = el.id;
		var target = ev.target;

		while (target.tagName != "A" && target.tagName != "FORM" && target != el) target = target.parentNode;
		if (target.tagName == "A") {
			sj.call(target.hash, target);
			ev.preventDefault();
		} else if (target.tagName == "FORM" && ev.type == 'submit') {
			var hash = target.action;
			var n = hash.search(/#[!\?]/);
			if (n > -1) hash = hash.substring(n);
			sj.call(hash, target);
			ev.preventDefault();
		} else {
			components[id].onclick(ev, target);
		}
	}

	this.call = function(query, element) {
		var params = {}, ps = query.substring(2).split(/[&=]/);
		for (var i = 0; i < ps.length; i+=2) params[ps[i]] = ps[i+1];
		params.mode = query.substring(0, 2);

		onBeforeAction(params);

		if (params.mode == "#?") {
			components[params.do].onrequest(params, element);
			sj.request(query, element);
		} else if (params.mode == "#!") {
			if (!params.action) params.action = "action";
			if (!params.method) params.method = "internal";
			params.identry = params.method+"/"+params.action;
			var res = components[params.do].onaction(params, element);
			if (typeof res == "undefined" || res === false) {
				onDefaultAction(params);
			}
		}
	}

	this.request = function(query, form) {
		if (!endpoint) throw "No endpoint defined!";
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("load", function(ev) {
			try {
				var json = JSON.parse(ev.target.responseText);
			} catch (e) {
				console.debug(ev.target.responseText);
				return;
			}
			if (!json.action) json.action = "action";
			if (!json.method) json.method = "internal";
			if (!json.do) json.do = json.component;
			json.identry = json.method+"/"+json.action;
			if (json.error) {
				components[json.component].onerror(json);
			} else if (json.component && components[json.component]) {
				onBeforeAction(json);
				var res = components[json.component].onaction(json);
				if (typeof res == "undefined" || res === false) {
					onDefaultAction(json);
				}
			} else {
				throw "Component `"+json.component+"` not found";
			}
			if (onRequestComplete) onRequestComplete();
			document.body.classList.remove("wait");
		}, false);
		xhr.addEventListener("error", function(ev) {
			onRequestError(ev);
			console.error(ev.message, ev);
		}, false);

		if (typeof query == "string") query = parseHash(query);
		if (onBeforeRequest) onBeforeRequest(query, form);
		var q = [];
		for (var i in query) q.push(i+"="+encodeURIComponent(query[i]));
		var url = endpoint+"?"+q.join("&");

		if (form && (form.tagName == "FORM" || form instanceof FormData)) {
			if (form instanceof FormData) {
				xhr.open('POST', url);
				xhr.send(form);
			} else if (form.method == "post") {
				form = new FormData(form);
				xhr.open('POST', url);
				xhr.send(form);
			} else {
				var p = [];
				for (var i = 0; i < form.elements.length; i++) {
					var el = form.elements[i];
					if (el.hasAttribute("name")) {
						switch (el.type) {
							case "select":
								p.push(el.name+"="+el.options[el.selectedIndex].value);
								break;
							case "checkbox":
								// TODO
								break;
							case "radio":
								// TODO
								break;
							default:
								p.push(el.name+"="+encodeURIComponent(el.value));
						}
					}
				}
				xhr.open('GET', url+"&"+p.join("&"));
				xhr.send();
			}
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

	// Called before request to server is executed. Useful to add common params or to log history
	var onBeforeRequest = function() {};
	// Called when request is executed. Useful to show spinner.
	var onRequestWait = function() {};
	// Called when request is completed. Useful to hide spinner.
	var onRequestComplete = function() {};

	// Called before the onAction slot is called. Useful to log history.
	var onBeforeAction = function() {};
	// Called when Component does not override his onAction slot.
	var onDefaultAction = function() {};
	// Called when no action Component is defined
	var onFallbackAction = function() {};
	// Called when Component does not override his onClick slot.
	var onClickCallback = function() {};
	// Called when Component does not override his onSubmit slot.
	var onSubmitCallback = function() {};
	// Called when Component does not override his onError slot.
	var onRequestError = function(json) { console.error(json) };

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
