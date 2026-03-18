const size = 'L';
const item = {
    name: 'L Beden Variant',
    sku: 'TS-L'
};

const sizePattern = new RegExp(`(?:^|[^a-zA-Z0-9])(${size})(?:[^a-zA-Z0-9]|$)`, 'i');

console.log("Pattern:", sizePattern);
console.log("Test name:", sizePattern.test(item.name));
console.log("Test sku:", item.sku === size);
console.log("Test name lower:", item.name.toLowerCase() === size.toLowerCase());
