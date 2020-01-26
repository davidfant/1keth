import * as chai from 'chai';
import { BigNumber } from 'bignumber.js';
import { CanvasInstance } from '../app/contracts';
const Canvas = artifacts.require('Canvas');

chai.use(require('chai-as-promised'));
const expect = chai.expect;

const toNumber = (bigNumber: BigNumber): number => bigNumber.toNumber();
const toString = (bigNumber: BigNumber): string => bigNumber.toString();
const toWei = (ether: number): string => web3.utils.toWei(String(ether), 'ether').toString();
const toEth = (wei: string): number => Number(web3.utils.fromWei(wei, 'ether'));

interface Pixel {
    x: BigNumber;
    y: BigNumber;
    url: string;
    color: BigNumber;
    owner: string;
    exists: boolean;
}

contract('Canvas', ([owner, buyer]) => {

    const width = 1000;
    const height = 1000;
    const pricePerPixel = 0.001;
    let canvas: CanvasInstance;
    let coinbase: string;

    beforeEach(async () => {
        canvas = await Canvas.new(width, height, toWei(pricePerPixel));
        coinbase = await web3.eth.getCoinbase();
    });

    it('should initialise the contract', async () => {
        assert.equal(await canvas.width().then(toNumber), width);
        assert.equal(await canvas.height().then(toNumber), height);
        assert.equal(await canvas.pricePerPixel().then(toString), toWei(pricePerPixel));
        assert.equal(await canvas.owner(), owner);
    });

    describe('buyPixels', () => {

        const x = width / 2;
        const y = height / 2;
        const color = 0xff0033;
        const url = 'https://fant.io';
        const value = toWei(pricePerPixel);

        beforeEach(async () => {
            // https://github.com/ethereum/go-ethereum/wiki/Sending-ether
            web3.eth.sendTransaction({ from: coinbase, to: buyer, value: toWei(1) });
        });

        describe('fail', () => {

            it('should fail if x0 > x1', async () => {
                const promise = canvas.buyPixels(1, 0, 0, 0, [color], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Pixel range is invalid');
            });

            it('should fail if y0 > y1', async () => {
                const promise = canvas.buyPixels(0, 1, 0, 0, [color], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Pixel range is invalid');
            });

            it('should fail if coordinate is negative', async () => {
                const promise = canvas.buyPixels(-1, y, -1, y, [color], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Pixel range is out of bounds');
            });
    
            it('should fail if pixel value is too big', async () => {
                const promise = canvas.buyPixels(width, y, width, y, [color], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Pixel range is out of bounds');
            });
    
            it('should fail if color is invalid', async () => {
                const promise = canvas.buyPixels(x, y, x, y, [0x12345678], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Color is invalid');
            });
    
            it('should fail if insufficient funds were paid', async () => {
                const promise = canvas.buyPixels(x, y, x, y, [color], url, { value: toWei(0) });
                await expect(promise).to.eventually.be.rejectedWith('Insufficient ether');
            });
    
            it('should fail if pixel is already purchased', async () => {
                await canvas.buyPixels(x, y, x, y, [color], url, { value });
                const promise = canvas.buyPixels(x, y, x, y, [color], url, { value, from: buyer });
                await expect(promise).to.eventually.be.rejectedWith('Pixel already purchased');
            });

            describe('multiple', () => {

                it('should fail if one of multiple pixels fails', async () => {
                    const validColor = color;
                    const invalidColor = 0x12345678;
                    const promise = canvas.buyPixels(x, y, x + 1, y, [validColor, invalidColor], url, { value });
                    await expect(promise).to.eventually.be.rejectedWith('Color is invalid');

                    const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                    assert.equal(balance, 0);

                    const validPixel: Pixel = await canvas.pixels(x, y) as any;
                    const invalidPixel: Pixel = await canvas.pixels(x + 1, y) as any;
                    assert.isFalse(validPixel.exists);
                    assert.isFalse(invalidPixel.exists);
                });

            });

        });

        describe('success', () => {
            
            it('should register pixel', async () => {
                await canvas.buyPixels(x, y, x, y, [color], url, { value, from: buyer });
                const pixel: Pixel = await canvas.pixels(x, y) as any;
                assert.isTrue(pixel.exists);
                assert.equal(pixel.x.toNumber(), x);
                assert.equal(pixel.y.toNumber(), y);
                assert.equal(pixel.url, url);
                assert.equal(pixel.color.toNumber(), color);
                assert.equal(pixel.owner, buyer);
            });

            it('should add balance to the contract', async () => {
                // const balanceBefore = await web3.eth.getBalance(buyer).then(toEth);
                await canvas.buyPixels(x, y, x, y, [color], url, { value });
                // const balanceAfter = await web3.eth.getBalance(buyer).then(toEth);
                const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balance, pricePerPixel);
            });
            
            it('should send back excess ether', async () => {
                await canvas.buyPixels(x, y, x, y, [color], url, { value: toWei(pricePerPixel * 2) });
                const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balance, pricePerPixel);
            });

            it('should allow updating pixels', async () => {
                const updatedColor = 0x133337;
                await canvas.buyPixels(x, y, x, y, [color], url, { value, from: buyer });
                await canvas.buyPixels(x, y, x, y, [updatedColor], url, { value, from: buyer });
                // only increase the balance once, not for the update
                const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balance, pricePerPixel);

                const pixel: Pixel = await canvas.pixels(x, y) as any;
                assert.equal(pixel.color.toNumber(), updatedColor);
            });

            describe('multiple', () => {

                it('should register multiple pixels', async () => {
                    await canvas.buyPixels(0, 0, 1, 0, [color, color], url, { value: toWei(pricePerPixel * 2) });
                    const pixels: Pixel[] = await Promise.all([canvas.pixels(0, 0), canvas.pixels(1, 0)] as any[]);
                    assert.isTrue(pixels[0].exists);
                    assert.isTrue(pixels[1].exists);

                    const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                    assert.equal(balance, pricePerPixel * 2);
                });

            });

        });

    });

    describe('withdraw', () => {

        describe('fail', () => {

            it('should fail if non-owner tries to withdraw', async () => {
                const promise = canvas.withdraw(toWei(1), { from: buyer });
                await expect(promise).to.eventually.be.rejectedWith('Sender not authorized');
            });

            it('should fail if trying to withdraw more than the current balance', async () => {
                const promise = canvas.withdraw(toWei(1), { from: owner });
                await expect(promise).to.eventually.be.rejectedWith('Insufficient funds');
            });

        });

        describe('success', () => {

            it('should fail if owner tries to withdraw the current balance', async () => {
                await canvas.buyPixels(0, 0, 0, 0, [0xff0033], 'https://fant.io', { value: toWei(pricePerPixel) });

                const balanceBefore = await web3.eth.getBalance(canvas.address).then(toEth);
                const withdrawAmount = 0.0001;
                await canvas.withdraw(toWei(withdrawAmount), { from: owner });
                const balanceAfter = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balanceBefore, balanceAfter + withdrawAmount);
            });

        });

    });

});
