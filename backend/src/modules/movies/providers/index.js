// Movie module - providers re-export
// De giu nguyen duong dan import cu
const BaseApiProvider = require('../../services/BaseApiProvider');
const OphimProvider = require('../../services/ophimApi');
const KKPhimProvider = require('../../services/kkphimApi');
const NguonCProvider = require('../../services/nguoncApi');

module.exports = { BaseApiProvider, OphimProvider, KKPhimProvider, NguonCProvider };
