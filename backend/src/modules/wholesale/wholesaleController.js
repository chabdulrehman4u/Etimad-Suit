import { WholesaleCustomer } from './WholesaleCustomer.js';
import { Quotation } from './Quotation.js';
import {
  createCustomer,
  createQuotation,
  convertQuotationToOrder,
  recordCustomerKhataPayment,
} from './wholesaleService.js';

export const createWholesaleCustomer = async (req, res) => {
  try {
    const customer = await createCustomer({
      tenantId: req.tenantId,
      ...req.body,
    });

    return res.status(201).json({
      success: true,
      data: customer,
      message: 'Wholesale customer created successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CUSTOMER_CREATE_FAILED', message: err.message },
    });
  }
};

export const listWholesaleCustomers = async (req, res) => {
  try {
    const query = req.scopeTenant({});
    if (req.query.search) {
      const term = String(req.query.search).trim();
      query.$or = [{ name: { $regex: term, $options: 'i' } }, { phone: term }, { companyName: { $regex: term, $options: 'i' } }];
    }

    const customers = await WholesaleCustomer.find(query).sort({ name: 1 });
    return res.json({
      success: true,
      data: customers,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'CUSTOMERS_FETCH_FAILED', message: err.message },
    });
  }
};

export const createWholesaleQuotation = async (req, res) => {
  try {
    const { customerId, items, discountTotal, validDays, notes } = req.body || {};
    const quotation = await createQuotation({
      tenantId: req.tenantId,
      customerId,
      items,
      discountTotal,
      validDays,
      notes,
      actorId: req.user?._id,
    });

    return res.status(201).json({
      success: true,
      data: quotation,
      message: 'Wholesale quotation generated successfully.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'QUOTATION_CREATE_FAILED', message: err.message },
    });
  }
};

export const listQuotations = async (req, res) => {
  try {
    const query = req.scopeTenant({});
    if (req.query.customerId) {
      query.customerId = req.query.customerId;
    }
    if (req.query.status) {
      query.status = req.query.status;
    }

    const quotations = await Quotation.find(query).sort({ createdAt: -1 });
    return res.json({
      success: true,
      data: quotations,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: { code: 'QUOTATIONS_FETCH_FAILED', message: err.message },
    });
  }
};

export const convertQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, amountPaid, notes } = req.body || {};

    const result = await convertQuotationToOrder({
      tenantId: req.tenantId,
      quotationId: id,
      paymentMethod,
      amountPaid,
      notes,
      actorId: req.user?._id,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Quotation successfully converted to canonical wholesale order.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'CONVERSION_FAILED', message: err.message },
    });
  }
};

export const receiveCustomerKhataPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference } = req.body || {};

    const result = await recordCustomerKhataPayment({
      tenantId: req.tenantId,
      customerId: id,
      amount,
      paymentMethod,
      reference,
      actorId: req.user?._id,
    });

    return res.json({
      success: true,
      data: result,
      message: 'Customer khata payment recorded and balance updated.',
    });
  } catch (err) {
    return res.status(400).json({
      success: false,
      error: { code: 'PAYMENT_FAILED', message: err.message },
    });
  }
};
