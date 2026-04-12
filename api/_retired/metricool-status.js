/**
 * metricool-status.js — Returns Jon's Metricool connection status
 * GET /api/metricool-status
 */

const METRICOOL_KEY = process.env.METRICOOL_API_KEY;
const METRICOOL_USER_ID = process.env.METRICOOL_USER_ID || '4687727';
const METRICOOL_BLOG_ID = process.env.METRICOOL_BLOG_ID || '6073509';

export default async function handler(req, res) {
  try {
    const response = await fetch(
      `https://app.metricool.com/api/admin/simpleProfiles?blogId=${METRICOOL_BLOG_ID}&userId=${METRICOOL_USER_ID}`,
      { headers: { 'X-Mc-Auth': METRICOOL_KEY } }
    );

    if (!response.ok) throw new Error(`Metricool API error: ${response.status}`);
    const brands = await response.json();
    const brand = Array.isArray(brands) ? brands[0] : brands;

    return res.status(200).json({ success: true, brand });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
