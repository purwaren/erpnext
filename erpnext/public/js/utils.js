// Copyright (c) 2015, Frappe Technologies Pvt. Ltd. and Contributors
// License: GNU General Public License v3. See license.txt
frappe.provide("erpnext");
frappe.provide("erpnext.utils");

$.extend(erpnext, {
	get_currency: function(company) {
		if(!company && cur_frm)
			company = cur_frm.doc.company;
		if(company)
			return frappe.get_doc(":Company", company).default_currency || frappe.boot.sysdefaults.currency;
		else
			return frappe.boot.sysdefaults.currency;
	},

	get_presentation_currency_list: () => {
		const docs = frappe.boot.docs;
		let currency_list = docs.filter(d => d.doctype === ":Currency").map(d => d.name);
		currency_list.unshift("");
		return currency_list;
	},

	toggle_naming_series: function() {
		if(cur_frm.fields_dict.naming_series) {
			cur_frm.toggle_display("naming_series", cur_frm.doc.__islocal?true:false);
		}
	},

	hide_company: function() {
		if(cur_frm.fields_dict.company) {
			var companies = Object.keys(locals[":Company"] || {});
			if(companies.length === 1) {
				if(!cur_frm.doc.company) cur_frm.set_value("company", companies[0]);
				cur_frm.toggle_display("company", false);
			} else if(erpnext.last_selected_company) {
				if(!cur_frm.doc.company) cur_frm.set_value("company", erpnext.last_selected_company);
			}
		}
	},

	is_perpetual_inventory_enabled: function(company) {
		if(company) {
			return frappe.get_doc(":Company", company).enable_perpetual_inventory
		}
	},

	stale_rate_allowed: () => {
		return cint(frappe.boot.sysdefaults.allow_stale);
	},

	setup_serial_no: function() {
		var grid_row = cur_frm.open_grid_row();
		if(!grid_row || !grid_row.grid_form.fields_dict.serial_no ||
			grid_row.grid_form.fields_dict.serial_no.get_status()!=="Write") return;

		var $btn = $('<button class="btn btn-sm btn-default">'+__("Add Serial No")+'</button>')
			.appendTo($("<div>")
				.css({"margin-bottom": "10px", "margin-top": "10px"})
				.appendTo(grid_row.grid_form.fields_dict.serial_no.$wrapper));

		var me = this;
		$btn.on("click", function() {
			me.show_serial_batch_selector(grid_row.frm, grid_row.doc);
		});
	},

	get_dimension_filters: async function() {
		if (!frappe.model.can_read('Accounting Dimension')) {
			return [];
		}
		let dimensions = await frappe.db.get_list('Accounting Dimension', {
			fields: ['label', 'fieldname', 'document_type'],
			filters: {
				disabled: 0
			}
		});

		return dimensions;
	}
});


$.extend(erpnext.utils, {
	set_party_dashboard_indicators: function(frm) {
		if(frm.doc.__onload && frm.doc.__onload.dashboard_info) {
			var company_wise_info = frm.doc.__onload.dashboard_info;
			if(company_wise_info.length > 1) {
				company_wise_info.forEach(function(info) {
					erpnext.utils.add_indicator_for_multicompany(frm, info);
				});
			} else if (company_wise_info.length === 1) {
				frm.dashboard.add_indicator(__('Annual Billing: {0}',
					[format_currency(company_wise_info[0].billing_this_year, company_wise_info[0].currency)]), 'blue');
				frm.dashboard.add_indicator(__('Total Unpaid: {0}',
					[format_currency(company_wise_info[0].total_unpaid, company_wise_info[0].currency)]),
				company_wise_info[0].total_unpaid ? 'orange' : 'green');

				if(company_wise_info[0].loyalty_points) {
					frm.dashboard.add_indicator(__('Loyalty Points: {0}',
						[company_wise_info[0].loyalty_points]), 'blue');
				}
			}
		}
	},

	add_indicator_for_multicompany: function(frm, info) {
		frm.dashboard.stats_area.removeClass('hidden');
		frm.dashboard.stats_area_row.addClass('flex');
		frm.dashboard.stats_area_row.css('flex-wrap', 'wrap');

		var color = info.total_unpaid ? 'orange' : 'green';

		var indicator = $('<div class="flex-column col-xs-6">'+
			'<div style="margin-top:10px"><h6>'+info.company+'</h6></div>'+

			'<div class="badge-link small" style="margin-bottom:10px"><span class="indicator blue">'+
			'Annual Billing: '+format_currency(info.billing_this_year, info.currency)+'</span></div>'+

			'<div class="badge-link small" style="margin-bottom:10px">'+
			'<span class="indicator '+color+'">Total Unpaid: '
			+format_currency(info.total_unpaid, info.currency)+'</span></div>'+


			'</div>').appendTo(frm.dashboard.stats_area_row);

		if(info.loyalty_points){
			$('<div class="badge-link small" style="margin-bottom:10px"><span class="indicator blue">'+
			'Loyalty Points: '+info.loyalty_points+'</span></div>').appendTo(indicator);
		}

		return indicator;
	},

	get_party_name: function(party_type) {
		var dict = {'Customer': 'customer_name', 'Supplier': 'supplier_name', 'Employee': 'employee_name',
			'Member': 'member_name'};
		return dict[party_type];
	},

	copy_value_in_all_rows: function(doc, dt, dn, table_fieldname, fieldname) {
		var d = locals[dt][dn];
		if(d[fieldname]){
			var cl = doc[table_fieldname] || [];
			for(var i = 0; i < cl.length; i++) {
				if(!cl[i][fieldname]) cl[i][fieldname] = d[fieldname];
			}
		}
		refresh_field(table_fieldname);
	},

	get_terms: function(tc_name, doc, callback) {
		if(tc_name) {
			return frappe.call({
				method: 'erpnext.setup.doctype.terms_and_conditions.terms_and_conditions.get_terms_and_conditions',
				args: {
					template_name: tc_name,
					doc: doc
				},
				callback: function(r) {
					callback(r)
				}
			});
		}
	},

	make_bank_account: function(doctype, docname) {
		frappe.call({
			method: "erpnext.accounts.doctype.bank_account.bank_account.make_bank_account",
			args: {
				doctype: doctype,
				docname: docname
			},
			freeze: true,
			callback: function(r) {
				var doclist = frappe.model.sync(r.message);
				frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
			}
		})
	},

	make_subscription: function(doctype, docname) {
		frappe.call({
			method: "frappe.desk.doctype.auto_repeat.auto_repeat.make_auto_repeat",
			args: {
				doctype: doctype,
				docname: docname
			},
			callback: function(r) {
				var doclist = frappe.model.sync(r.message);
				frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
			}
		})
	},

	make_pricing_rule: function(doctype, docname) {
		frappe.call({
			method: "erpnext.accounts.doctype.pricing_rule.pricing_rule.make_pricing_rule",
			args: {
				doctype: doctype,
				docname: docname
			},
			callback: function(r) {
				var doclist = frappe.model.sync(r.message);
				frappe.set_route("Form", doclist[0].doctype, doclist[0].name);
			}
		})
	},

	/**
	* Checks if the first row of a given child table is empty
	* @param child_table - Child table Doctype
	* @return {Boolean}
	**/
	first_row_is_empty: function(child_table){
		if($.isArray(child_table) && child_table.length > 0) {
			return !child_table[0].item_code;
		}
		return false;
	},

	/**
	* Removes the first row of a child table if it is empty
	* @param {_Frm} frm - The current form
	* @param {String} child_table_name - The child table field name
	* @return {Boolean}
	**/
	remove_empty_first_row: function(frm, child_table_name){
		const rows = frm['doc'][child_table_name];
		if (this.first_row_is_empty(rows)){
			frm['doc'][child_table_name] = rows.splice(1);
		}
		return rows;
	},
	get_tree_options: function(option) {
		// get valid options for tree based on user permission & locals dict
		let unscrub_option = frappe.model.unscrub(option);
		let user_permission = frappe.defaults.get_user_permissions();
		let options;

		if(user_permission && user_permission[unscrub_option]) {
			options = user_permission[unscrub_option].map(perm => perm.doc);
		} else {
			options = $.map(locals[`:${unscrub_option}`], function(c) { return c.name; }).sort();
		}

		// filter unique values, as there may be multiple user permissions for any value
		return options.filter((value, index, self) => self.indexOf(value) === index);
	},
	get_tree_default: function(option) {
		// set default for a field based on user permission
		let options = this.get_tree_options(option);
		if(options.includes(frappe.defaults.get_default(option))) {
			return frappe.defaults.get_default(option);
		} else {
			return options[0];
		}
	},
	copy_parent_value_in_all_row: function(doc, dt, dn, table_fieldname, fieldname, parent_fieldname) {
		var d = locals[dt][dn];
		if(d[fieldname]){
			var cl = doc[table_fieldname] || [];
			for(var i = 0; i < cl.length; i++) {
				cl[i][fieldname] = doc[parent_fieldname];
			}
		}
		refresh_field(table_fieldname);
	},

});

erpnext.utils.select_alternate_items = function(opts) {
	const frm = opts.frm;
	const warehouse_field = opts.warehouse_field || 'warehouse';
	const item_field = opts.item_field || 'item_code';

	this.data = [];
	const dialog = new frappe.ui.Dialog({
		title: __("Select Alternate Item"),
		fields: [
			{fieldtype:'Section Break', label: __('Items')},
			{
				fieldname: "alternative_items", fieldtype: "Table", cannot_add_rows: true,
				in_place_edit: true, data: this.data,
				get_data: () => {
					return this.data;
				},
				fields: [{
					fieldtype:'Data',
					fieldname:"docname",
					hidden: 1
				}, {
					fieldtype:'Link',
					fieldname:"item_code",
					options: 'Item',
					in_list_view: 1,
					read_only: 1,
					label: __('Item Code')
				}, {
					fieldtype:'Link',
					fieldname:"alternate_item",
					options: 'Item',
					default: "",
					in_list_view: 1,
					label: __('Alternate Item'),
					onchange: function() {
						const item_code = this.get_value();
						const warehouse = this.grid_row.on_grid_fields_dict.warehouse.get_value();
						if (item_code && warehouse) {
							frappe.call({
								method: "erpnext.stock.utils.get_latest_stock_qty",
								args: {
									item_code: item_code,
									warehouse: warehouse
								},
								callback: (r) => {
									this.grid_row.on_grid_fields_dict
										.actual_qty.set_value(r.message || 0);
								}
							})
						}
					},
					get_query: (e) => {
						return {
							query: "erpnext.stock.doctype.item_alternative.item_alternative.get_alternative_items",
							filters: {
								item_code: e.item_code
							}
						};
					}
				}, {
					fieldtype:'Link',
					fieldname:"warehouse",
					options: 'Warehouse',
					default: "",
					in_list_view: 1,
					label: __('Warehouse'),
					onchange: function() {
						const warehouse = this.get_value();
						const item_code = this.grid_row.on_grid_fields_dict.item_code.get_value();
						if (item_code && warehouse) {
							frappe.call({
								method: "erpnext.stock.utils.get_latest_stock_qty",
								args: {
									item_code: item_code,
									warehouse: warehouse
								},
								callback: (r) => {
									this.grid_row.on_grid_fields_dict
										.actual_qty.set_value(r.message || 0);
								}
							})
						}
					},
				}, {
					fieldtype:'Float',
					fieldname:"actual_qty",
					default: 0,
					read_only: 1,
					in_list_view: 1,
					label: __('Available Qty')
				}]
			},
		],
		primary_action: function() {
			const args = this.get_values()["alternative_items"];
			const alternative_items = args.filter(d => {
				if (d.alternate_item && d.item_code != d.alternate_item) {
					return true;
				}
			});

			alternative_items.forEach(d => {
				let row = frappe.get_doc(opts.child_doctype, d.docname);
				let qty = null;
				if (row.doctype === 'Work Order Item') {
					qty = row.required_qty;
				} else {
					qty = row.qty;
				}
				row[item_field] = d.alternate_item;
				frm.script_manager.trigger(item_field, row.doctype, row.name)
					.then(() => {
						frappe.model.set_value(row.doctype, row.name, 'qty', qty);
						frappe.model.set_value(row.doctype, row.name,
							opts.original_item_field, d.item_code);
					});
			});

			refresh_field(opts.child_docname);
			this.hide();
		},
		primary_action_label: __('Update')
	});

	frm.doc[opts.child_docname].forEach(d => {
		if (!opts.condition || opts.condition(d)) {
			dialog.fields_dict.alternative_items.df.data.push({
				"docname": d.name,
				"item_code": d[item_field],
				"warehouse": d[warehouse_field],
				"actual_qty": d.actual_qty
			});
		}
	})

	this.data = dialog.fields_dict.alternative_items.df.data;
	dialog.fields_dict.alternative_items.grid.refresh();
	dialog.show();
}

erpnext.utils.update_child_items = function(opts) {
	const frm = opts.frm;
	const cannot_add_row = (typeof opts.cannot_add_row === 'undefined') ? true : opts.cannot_add_row;
	const child_docname = (typeof opts.cannot_add_row === 'undefined') ? "items" : opts.child_docname;
	this.data = [];
	const dialog = new frappe.ui.Dialog({
		title: __("Update Items"),
		fields: [
			{fieldtype:'Section Break', label: __('Items')},
			{
				fieldname: "trans_items",
				fieldtype: "Table",
				cannot_add_rows: cannot_add_row,
				in_place_edit: true,
				data: this.data,
				get_data: () => {
					return this.data;
				},
				fields: [{
					fieldtype:'Data',
					fieldname:"docname",
					hidden: 0,
				}, {
					fieldtype:'Link',
					fieldname:"item_code",
					options: 'Item',
					in_list_view: 1,
					read_only: 1,
					label: __('Item Code')
				}, {
					fieldtype:'Float',
					fieldname:"qty",
					default: 0,
					read_only: 0,
					in_list_view: 1,
					label: __('Qty')
				}, {
					fieldtype:'Currency',
					fieldname:"rate",
					default: 0,
					read_only: 0,
					in_list_view: 1,
					label: __('Rate')
				}]
			},
		],
		primary_action: function() {
			const trans_items = this.get_values()["trans_items"];
			frappe.call({
				method: 'erpnext.controllers.accounts_controller.update_child_qty_rate',
				freeze: true,
				args: {
					'parent_doctype': frm.doc.doctype,
					'trans_items': trans_items,
					'parent_doctype_name': frm.doc.name,
					'child_docname': child_docname
				},
				callback: function() {
					frm.reload_doc();
				}
			});
			this.hide();
			refresh_field("items");
		},
		primary_action_label: __('Update')
	});

	frm.doc[opts.child_docname].forEach(d => {
		dialog.fields_dict.trans_items.df.data.push({
			"docname": d.name,
			"item_code": d.item_code,
			"qty": d.qty,
			"rate": d.rate,
		});
		this.data = dialog.fields_dict.trans_items.df.data;
		dialog.fields_dict.trans_items.grid.refresh();
	})
	dialog.show();
}

erpnext.utils.map_current_doc = function(opts) {
	if(opts.get_query_filters) {
		opts.get_query = function() {
			return {filters: opts.get_query_filters};
		}
	}
	var _map = function() {
		if($.isArray(cur_frm.doc.items) && cur_frm.doc.items.length > 0) {
			// remove first item row if empty
			if(!cur_frm.doc.items[0].item_code) {
				cur_frm.doc.items = cur_frm.doc.items.splice(1);
			}

			// find the doctype of the items table
			var items_doctype = frappe.meta.get_docfield(cur_frm.doctype, 'items').options;

			// find the link fieldname from items table for the given
			// source_doctype
			var link_fieldname = null;
			frappe.get_meta(items_doctype).fields.forEach(function(d) {
				if(d.options===opts.source_doctype) link_fieldname = d.fieldname; });

			// search in existing items if the source_name is already set and full qty fetched
			var already_set = false;
			var item_qty_map = {};

			$.each(cur_frm.doc.items, function(i, d) {
				opts.source_name.forEach(function(src) {
					if(d[link_fieldname]==src) {
						already_set = true;
						if (item_qty_map[d.item_code])
							item_qty_map[d.item_code] += flt(d.qty);
						else
							item_qty_map[d.item_code] = flt(d.qty);
					}
				});
			});

			if(already_set) {
				opts.source_name.forEach(function(src) {
					frappe.model.with_doc(opts.source_doctype, src, function(r) {
						var source_doc = frappe.model.get_doc(opts.source_doctype, src);
						$.each(source_doc.items || [], function(i, row) {
							if(row.qty > flt(item_qty_map[row.item_code])) {
								already_set = false;
								return false;
							}
						})
					})

					if(already_set) {
						frappe.msgprint(__("You have already selected items from {0} {1}",
							[opts.source_doctype, src]));
						return;
					}

				})
			}
		}

		return frappe.call({
			// Sometimes we hit the limit for URL length of a GET request
			// as we send the full target_doc. Hence this is a POST request.
			type: "POST",
			method: 'frappe.model.mapper.map_docs',
			args: {
				"method": opts.method,
				"source_names": opts.source_name,
				"target_doc": cur_frm.doc,
				'args': opts.args
			},
			callback: function(r) {
				if(!r.exc) {
					var doc = frappe.model.sync(r.message);
					cur_frm.dirty();
					erpnext.utils.clear_duplicates();
					cur_frm.refresh();
				}
			}
		});
	}
	if(opts.source_doctype) {
		var d = new frappe.ui.form.MultiSelectDialog({
			doctype: opts.source_doctype,
			target: opts.target,
			date_field: opts.date_field || undefined,
			setters: opts.setters,
			get_query: opts.get_query,
			action: function(selections, args) {
				let values = selections;
				if(values.length === 0){
					frappe.msgprint(__("Please select {0}", [opts.source_doctype]))
					return;
				}
				opts.source_name = values;
				opts.setters = args;
				d.dialog.hide();
				_map();
			},
		});
	} else if(opts.source_name) {
		opts.source_name = [opts.source_name];
		_map();
	}
}

erpnext.utils.clear_duplicates = function() {
	const unique_items = new Map();
	/*
		Create a Map of items with
		item_code => [qty, warehouse, batch_no]
	*/
	let items = [];

	for (let item of cur_frm.doc.items) {
		if (!(unique_items.has(item.item_code) && unique_items.get(item.item_code)[0] === item.qty &&
			unique_items.get(item.item_code)[1] === item.warehouse && unique_items.get(item.item_code)[2] === item.batch_no &&
			unique_items.get(item.item_code)[3] === item.delivery_date && unique_items.get(item.item_code)[4] === item.required_date &&
			unique_items.get(item.item_code)[5] === item.rate)) {

			unique_items.set(item.item_code, [item.qty, item.warehouse, item.batch_no, item.delivery_date, item.required_date, item.rate]);
			items.push(item);
		}
	}
	cur_frm.doc.items = items;
}

frappe.form.link_formatters['Item'] = function(value, doc) {
	if(doc && doc.item_name && doc.item_name !== value) {
		return value? value + ': ' + doc.item_name: doc.item_name;
	} else {
		return value;
	}
}

frappe.form.link_formatters['Employee'] = function(value, doc) {
	if(doc && doc.employee_name && doc.employee_name !== value) {
		return value? value + ': ' + doc.employee_name: doc.employee_name;
	} else {
		return value;
	}
}

// add description on posting time
$(document).on('app_ready', function() {
	if(!frappe.datetime.is_timezone_same()) {
		$.each(["Stock Reconciliation", "Stock Entry", "Stock Ledger Entry",
			"Delivery Note", "Purchase Receipt", "Sales Invoice"], function(i, d) {
			frappe.ui.form.on(d, "onload", function(frm) {
				cur_frm.set_df_property("posting_time", "description",
					frappe.sys_defaults.time_zone);
			});
		});
	}
});
