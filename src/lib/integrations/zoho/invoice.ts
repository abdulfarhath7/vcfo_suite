import { discoverBooks, listCustomers, listInvoices, listOrgs, listPayments } from './books';
import type { ZohoConn } from './types';

/**
 * Zoho Invoice: the same API as Books under /invoice/v3, with the organisation sent in the
 * `X-com-zoho-invoice-organizationid` header (registry.js). A firm on Invoice instead of Books
 * gets the same discovery and the same receivables sync.
 */
export const discoverInvoice = (conn: ZohoConn) => discoverBooks(conn, 'invoice');
export const listInvoiceOrgs = (conn: ZohoConn) => listOrgs(conn, 'invoice');
export const listInvoiceCustomers = (conn: ZohoConn, orgId: string) => listCustomers(conn, orgId, 'invoice');
export const listInvoiceInvoices = (conn: ZohoConn, orgId: string, from: string, to: string) => listInvoices(conn, orgId, from, to, 'invoice');
export const listInvoicePayments = (conn: ZohoConn, orgId: string, from: string, to: string) => listPayments(conn, orgId, from, to, 'invoice');
