const Canvas = artifacts.require("Canvas");

module.exports = function(deployer) {
    // width, height, pricePerPixel in wei
    deployer.deploy(Canvas, 1000, 1000, String(0.001 * 10e18));
};
