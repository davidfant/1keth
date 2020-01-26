
// https://www.trufflesuite.com/docs/truffle/reference/configuration
module.exports = {
    networks: {
        ropsten: {
            provider: function() {
                return new HDWalletProvider(mnemonic, 'https://ropsten.infura.io/v3/1keth');
            },
            network_id: '3',
        },
        development: {
            host: '127.0.0.1',
            port: 8545,
            network_id: '*', // Match any network id
            gas: 3000000,
        }
    }
};
