"use strict";

class ComponentClass {

	constructor(id, obj) {
		this.id = id;
		this.el = document.getElementById(id);
		if (!this.el) throw "Component `"+id+"` not found";
		this.el.setAttribute("data-component", "");
		this.loop = this.el;

		this.oncreate = function() {}
		this.onshow = function() {}
		this.onpostshow = function() {}
		this.onprehide = function() {}
		this.onhide = function() {}
		this.onclick = function(ev, target) { sj.onClickCallback(ev, this.el, target) }
		this.onaction = function(action, target, ev) {
			if (this[action.identry]) {
				this[action.identry](action, target, ev);
				return true;
			} else {
				return sj.onDefaultAction(action, target, this, ev);
			}
		};

		this.onsubmit = function(ev, target) { sj.onSubmitCallback(ev, this.el, target) }
		this.onrequest = function() {}
		this.onresponse = function() {}
		this.onerror = function(json) { sj.onRequestError(json) }

		for (var i in obj) {
			if (i == "loop") obj[i] = document.getElementById(obj[i]);
			this[i] = obj[i];
		}
	}

	hide() {
		this.onprehide();
		this.el.hidden = true;
		this.onhide();
	}

	show() {
		this.onshow();
		this.el.hidden = false;
		this.onpostshow();
	}

	visible(b) {
		if (b) this.show(); else this.hide();
	}

	action(q) {
		sj.request(q);
	}

	$(id) {
		return this.el.querySelector("[data-id="+id+"]");
	}

	getElement(id) {
		return this.$(id);
	}


	/**
		Render function p = { k: { dataid: v } }
		@param HTMLElement Element to be modified
		@param Object Field to be set
		@param Object Render options
	*/
	renderSingle(el, p, opt) {
		for (var k in p) {
			var a = p[k];
			if (typeof a == "string" || typeof a == "number" || a instanceof Array || a instanceof HTMLElement) a = { _: a };
			else if (a === null) a = { _: "" };
			else if (typeof a == "boolean") a = { _visible: a };

			var list = k == "_" ? [el] : Array.from(el.querySelectorAll("[data-id="+k+"]"));
			if (!list.length) console.debug("Element `"+k+"` not found", el);

			list.forEach((l) => {
				for (var i in a) {
					if (l.hasAttribute("data-if")) {
						l.hidden = ((a[i] instanceof Array && !a[i].length) || !a[i]);
						continue;
					} else if (l.hasAttribute("data-else")) {
						l.hidden = !((a[i] instanceof Array && !a[i].length) || !a[i]);
						continue;
					} else if (l.hasAttribute("data-when")) {
						if ((a[i] instanceof Array && !a[i].length) || !a[i]) {
							l.hidden = true;
							continue;
						} else {
							l.hidden = false;
						}
					} else if (i == "_visible") {
						l.hidden = !a[i];
						continue;
					}

					if (i == "_") {
						if (a[i] instanceof Array) {
							this.renderArray(l, a[i], opt);
						} else if (a[i] instanceof HTMLElement) {
							l.parentNode.replaceChild(a[i], l);
						} else if (l.tagName == "INPUT" && (l.type == "radio" || l.type == "checkbox")) {
							l.checked = (l.value == a[i]);
						} else if (l.tagName == "INPUT" || l.tagName == "TEXTAREA") {
							l.value = a[i];
						} else if (l.tagName == "SELECT") {
							for (var j = 0; j < l.options.length; j++) l.options[j].selected = (l.options[j].value == a[i]);
						} else if (l.hasAttribute('data-html')) {
							l.innerHTML = a[i];
						} else {
							l.innerHTML = "";
							l.appendChild(document.createTextNode(a[i]));
						}
					} else if (i == "style") {
						for (var j in a[i]) l.style[j] = a[i][j];
					} else if (i == "data") {
						for (var j in a[i]) l.dataset[j] = a[i][j];
					} else if (i == "visible") {
						l.hidden = !a[i];
					} else if (i == "hidden") {
						l.hidden = a[i];
					} else if (i == "className") {
						l.className = a[i];
					} else if (i == "classList") {
						if (a[i] instanceof Array == false) a[i] = [a[i]];
						for (var j in a[i]) {
							if (!a[i][j]) continue;
							if (a[i][j][0] == "-") {
								l.classList.remove(a[i][j].substring(1));
							} else if (a[i][j][0] == "+") {
								l.classList.add(a[i][j].substring(1));
							} else {
								l.classList.toggle(a[i][j]);
							}
						}
					} else if (a[i] === false) {
						l.removeAttribute(i);
					} else if (a[i] === true) {
						l.setAttribute(i, "");
					} else {
						l.setAttribute(i, a[i]);
					}
				}
			});
		}
	}

	renderArray(el, p, opt) {
		if (el.dataset.template) {
			if (!opt.append) el.innerHTML = "";
			el.hidden = false;
			let tpl = this.$(el.dataset.template);
			p.forEach(i => {
				if (i instanceof HTMLElement) {
					el.appendChild(i);
				} else {
					var clone = document.importNode(tpl.content.children[0], true);
					this.renderSingle(clone, i, opt);
					el.appendChild(clone);
				}
			});
		} else {
			if (!opt.append && el.lastElementChild) while (el.children.length > 1) el.removeChild(el.lastElementChild);
			el.hidden = false;
			p.forEach((i) => {
				if (i instanceof HTMLElement) {
					el.appendChild(i);
				} else {
					var clone = el.firstElementChild.cloneNode(true);
					clone.hidden = false;
					this.renderSingle(clone, i, opt);
					el.appendChild(clone);
				}
			});
		}
	}

	render(p, opt) {
		if (!sj.loaded || !p || typeof p != "object") return;
		if (!opt) opt = {};

		let el;
		if (!opt.sub) {
			el = this.el;
		} else if (typeof opt.sub == "string") {
			el = this.el.querySelector("[data-id="+opt.sub+"]");
		} else if (typeof opt.sub == "object") {
			let t = opt.sub;
			while (t != document.body && t != this.el) t = t.parentNode;
			if (t == this.el) {
				el = opt.sub;
			} else {
				throw "Element outside the Component";
			}
		}
		if (!el) throw "Root element not found";

		this.renderSingle(el, p, opt);

		if (this.onrender) this.onrender();
	}
}


var sj = new function(endpoint) {

	// General endpoint for client-server interaction
	this.setEndpoint = function(url) { endpoint = url };

	// *** Hooks *** //

	// Called before request to server is executed. Useful to add common params or to log history
	var onBeforeRequest = function() {};
	this.setBeforeAction = function(callback) { onBeforeAction = callback };

	// Called when request is executed. Useful to show spinner.
	var onRequestWait = function() {};
	this.setRequestWait = function(callback) { onRequestWait = callback };

	// Called when request is completed. Useful to hide spinner.
	var onRequestComplete = function() {};
	this.setRequestComplete = function(callback) { onRequestComplete = callback };

	// Called before a call is done, useful for auto saving.
	var onUnloadAction = function() {};
	this.setUnloadAction = function(callback) { onUnloadAction = callback };

	// Called before the onAction slot is called. Useful to log history.
	var onBeforeAction = function() {};
	this.setBeforeRequest = function(callback) { onBeforeRequest = callback };

	// Called when Component does not override his onAction slot.
	this.onDefaultAction = function() {};
	this.setDefaultAction = function(callback) { this.onDefaultAction = callback };

	// Called when no action Component is defined
	var onFallbackAction = function() {};
	this.setFallbackAction = function(callback) { onFallbackAction = callback };

	// Called when Component does not override his onClick slot.
	this.onClickCallback = function() {};
	this.setClickCallback = function(callback) { this.onClickCallback = callback };

	// Called when Component does not override his onSubmit slot.
	this.onSubmitCallback = function() {};

	// Called when Component does not override his onError slot.
	this.onRequestError = function(json) { console.error(json) };
	this.setRequestError = function(callback) { this.onRequestError = callback };

	this.component = function(id, obj) {
		components[id] = (obj ? obj : {});

		if (sj.loaded) {
			components[id] = new ComponentClass(id, obj);
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
		if (sj.loaded) {
			containers[id] = new containerClass(id, start, obj);
		}
	}

	/**
	 * Get Component by ID
	 * @param String Component ID
	 * @returns Component
	 */
	this.$ = function(id) {
		if (components[id]) {
			return components[id];
		} else if (containers[id]) {
			return containers[id];
		} else {
			console.error("`"+id+"` not found");
		}
	}

	/**
	 * Get Component by Element
	 * @param DOMElement Element to analyze
	 * @returns Component
	 */
	this.$$ = function(el) {
		while (el && !el.hasAttribute("data-component")) el = el.parentNode;
		return el ? sj.$(el.id) : null;
	}

	function parseHash(hash) {
		var q = {}, method;

		var n = hash.search(/#[!\?>]/);
		if (n > -1) {
			hash = hash.substring(n+2);
			method = hash.substring(1, 1);
		}

		var p = hash.split(/[&=]/);
		for (var i = 0; i < p.length; i+=2) q[p[i]] = (p[i+1] ? p[i+1] : null);
		return { q: q, m: method };
	}

	function onaction(ev) {

		var el = ev.target;
		if (!el || el.hasAttribute("target") || el.hasAttribute("download")) return;
		while (el && !el.hasAttribute("data-component") && el != document.body) el = el.parentNode;
		if (!el || el == document.body) {
			onFallbackAction(el);
			return;
		}
		var id = el.id;
		var target = ev.target;

		while (target.tagName != "A" && target.tagName != "AREA" && target.tagName != "FORM" && target != el) target = target.parentNode;
		if (target.tagName == "A" || target.tagName == "AREA") {
			if (onUnloadAction({ query: target.hash, element: target }) !== false) sj.call(target.hash, target, ev);
			ev.preventDefault();
		} else if (target.tagName == "FORM" && ev.type == 'submit') {
			var hash = target.action;
			var n = hash.search(/#[!\?]/);
			if (n > -1) hash = hash.substring(n);
			if (onUnloadAction({ query: hash, element: target }) !== false) sj.call(hash, target);
			ev.preventDefault();
		} else {
			onFallbackAction(el, ev);
		}
	}

	this.call = function(query, element, ev) {
		var params = {}, ps = query.substring(2).split(/[&=]/);
		for (var i = 0; i < ps.length; i+=2) params[ps[i]] = ps[i+1];
		params.mode = query.substring(0, 2);

		if (params.mode == "#?") {
			components[params.do].onrequest(params, element);
			sj.request(query, element);
		} else if (params.mode == "#!") {
			_internal(params, element, ev);
		}
	}

	/**
	 * Call to internal
	 * @param String|Component Component
	 * @param NULL|String|Object Params for call, or action name
	 * @param NULL|Object Params for call if first parameter is action name
	 */
	this.internal = function(component, p1 = null, p2 = null, p3 = null) {
		let params, element;
		if (typeof p1 == "object") {
			params = p1 || {};
			params.action = "action";
			element = p2;
		} else if (typeof p1 == "string") {
			params = p2 || {};
			params.action = p1;
			element = p3;
		} else {
			throw "Invalid params for sj.internal()";
		}

		params.do = (typeof component == "object" ? component.id : component);

		_internal(params, element);
	}

	function _internal(params, element, ev) {
		params.method = "internal";
		if (!params.action) params.action = "action";
		params.identry = params.method+"/"+params.action;
		params.params = {};
		onBeforeAction(params);
		if (!components[params.do]) throw "Component `"+params.do+"` not found";
		var res = components[params.do].onaction(params, element, ev);
		if (typeof res == "undefined" || res === false) {
			sj.onDefaultAction(params);
		}
	}

	this.request = function(query, form) {
		if (!endpoint) throw "No endpoint defined!";
		var xhr = new XMLHttpRequest();
		xhr.addEventListener("load", function(ev) {
			try {
				var json = JSON.parse(ev.target.responseText);
			} catch (e) {
				console.error(ev.target.responseText);
				onRequestError(ev);
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
			console.error(ev.message, ev);
			onRequestError(ev);
		}, false);

		if (typeof query == "string") query = parseHash(query);
		if (onBeforeRequest) onBeforeRequest(query.q, form);
		var q = [];
		for (var i in query.q) q.push(i+"="+encodeURIComponent(query.q[i]));
		var url = endpoint+"?"+q.join("&");

		xhr.withCredentials = true;
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
			if (query.m == '>') {
				xhr.open('PUT', url);
			} else {
				xhr.open('GET', url);
			}
			xhr.send();
		}

		if (onRequestWait) onRequestWait(query.q, form);
	}

	this.loaded = false;
	var endpoint = null;
	var components = {};
	var containers = {};

	document.addEventListener('DOMContentLoaded', () => {
		document.body.addEventListener("click", onaction, false);
		document.body.addEventListener("submit", onaction, false);

		this.loaded = true;
		for (var i in components) {
			this.component(i, components[i]);
		}
		for (var i in containers) {
			this.container(i, containers[i][0], containers[i][1]);
		}

		var event = document.createEvent('Event');
		event.initEvent('SjStarted', true, true);
		document.dispatchEvent(event);
	}, false);
};
