const ErrorHandler = require("../utils/errorHandler")

class Validate {
  constructor() {
    this.userAttr = {
      create: ["fullname", "email", "password", "mobile_no", "country", "city"],
      update: [""]
    }

    this.warehouseAttr = {
      assign: ["warehouses", "controllerId", "warehouse", "managerId", "controllers", "warehouseId"]
    }

    this.orderAttr = {
      create: ["address", "items", "warehouse", "user"],
      update: ["tin_no", "address", "transit_company", "consignee", "custom_agent", "DDCOM_no", "quantity_decl", "physical_quant", "arrival_date", "last_storage_date", "truck_no", "container_no", "transporter", "ref_no", "desc_product", "unit", "comment", "name_counter", "counter_valid", "customs", "client_valid"]

    }

    this.missingFields = (fields, req) => {
      const reqFields = new Set(Object.keys(req.body));
      const misFields = fields.filter(k => !reqFields.has(k));
      return misFields.length > 0 && `Required Fields ${misFields.join(', ')}.`;
    }

    this.warehouseAssign = (req) => {
      const reqFields = new Set(Object.keys(req.body));
      if (reqFields.size === 0)
        return `Required Fields ${this.warehouseAttr.assign.join(', ')}`;

      if (reqFields.has("controllerId") && !reqFields.has("warehouses"))
        return 'Required Field warehouses';

      if (!reqFields.has("controllerId") && reqFields.has("warehouses"))
        return 'Required Field controllerId';

      if (reqFields.has("controllers") && !reqFields.has("warehouseId"))
        return 'Required Field warehouseId';

      if (!reqFields.has("controllers") && reqFields.has("warehouseId"))
        return 'Required Field controllers';

      if (reqFields.has("managerId") && !reqFields.has("warehouse"))
        return 'Required Field warehouse';

      if (!reqFields.has("managerId") && reqFields.has("warehouse"))
        return 'Required Field managerId';
    }

    this.warehouseRemove = (req) => {
      const reqFields = new Set(Object.keys(req.body));
      if (reqFields.size === 0)
        return "Required Fields `controllerId and warehouseId` or `managerId and warehouseId";

      if (reqFields.has("controllerId") && !reqFields.has("warehouseId"))
        return 'Required Field warehouseId';
    }
  }

  user = {
    post: async (req, res, next) => {
      console.log("Inside user validate");
      const misFields = this.missingFields(this.userAttr.create, req);
      if (misFields)
        return next(new ErrorHandler(misFields, 400));
    }
  }

  warehouse = {
    assign: async (req, res, next) => {
      const misFields = this.warehouseAssign(req);
      if (misFields) return next(new ErrorHandler(misFields, 400));
      next();
    },
    remove: async (req, res, next) => {
      const misFields = this.warehouseRemove(req);
      if (misFields) return next(new ErrorHandler(misFields, 400));
      next();
    }
  }

  order = {
    post: async (req, res, next) => {
      const misFields = this.missingFields(this.orderAttr.create, req);
      if (misFields)
        return next(new ErrorHandler(misFields, 400));
      next();
    },
    put: async (req, res, next) => {
      req.body = Object.fromEntries(
        Object.entries(req.body).filter(([key, value]) =>
          this.orderAttr.update.includes(key)
        )
      );

      console.log({bodt: req.body});
      if (!req.body || Object.keys(req.body).length === 0) {
        return next(new ErrorHandler(`Please provide at least one of the fields - ${this.orderAttr.update.join(', ')}.`, 400));
      }

      next();
    },
    updateStatus: async (req, res, next) => {
      if (!req.body.status) {
        return next(new ErrorHandler("Please provide the status", 400));
      }

      req.body = Object.fromEntries(
        Object.entries(req.body).filter(([key, value]) =>
          key === 'status'
        )
      );
      next();
    },
    approve: async (req, res, next) => {
      req.body = {};
      req.body.manager_valid = true;
      next();
    },
    item: async (req, res, next) => {
      const { items } = req.body;
      if (!items) {
        return next(new ErrorHandler("Please provide items.", 400));
      }

      if (!items.length || items.length === 0) {
        return next(new ErrorHandler("Please add atleast one item.", 400));
      }

      next();
    },
    itemObj: async (req, res, next) => {
      const { quantity, name } = req.body;
      if (!quantity && !name) {
        return next(new ErrorHandler("Missing fields - quantity and name", 400));
      }
      next();
    }
  }
}

module.exports = new Validate();