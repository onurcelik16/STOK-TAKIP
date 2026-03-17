const { GenericStore } = require('./src/server/stores/generic/GenericStore.ts');
const tsNode = require('ts-node');
tsNode.register();

async function run() {
    const { GenericStore } = require('./src/server/stores/generic/GenericStore');
    console.log("Testing with M size:");
    let res = await GenericStore.checkProduct({
        url: 'https://www.hepsiburada.com/altinyildiz-classics-erkek-lacivert-anti-pilling-tuylenme-yapmayan-standart-fit-bato-yaka-soguk-gecirmez-polar-sweatshirt-p-HBV0000135ELV',
        size: 'M'
    });
    console.log("Result M:", res);

    console.log("\nTesting with S size:");
    res = await GenericStore.checkProduct({
        url: 'https://www.hepsiburada.com/altinyildiz-classics-erkek-lacivert-anti-pilling-tuylenme-yapmayan-standart-fit-bato-yaka-soguk-gecirmez-polar-sweatshirt-p-HBV0000135ELV',
        size: 'S'
    });
    console.log("Result S:", res);
}
run();
