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

interface PixelInput {
    x: number;
    y: number;
    color: number;
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

        const input: PixelInput = { x: width / 2, y: height / 2, color: 0xff0033 };
        const url = 'https://fant.io';
        const value = toWei(pricePerPixel);

        beforeEach(async () => {
            // https://github.com/ethereum/go-ethereum/wiki/Sending-ether
            web3.eth.sendTransaction({ from: coinbase, to: buyer, value: toWei(1) });
        });

        describe('fail', () => {

            it('should fail if no pixels provided', async () => {
                const promise = canvas.buyPixels([], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('No pixels provided');
            });

            it('should fail if coordinate is negative', async () => {
                const promise = canvas.buyPixels([{ ...input, x: - 1}], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Pixel is out of bounds');
            });
    
            it('should fail if pixel value is too big', async () => {
                const promise = canvas.buyPixels([{ ...input, x: width + 1 }], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Pixel is out of bounds');
            });
    
            it('should fail if color is invalid', async () => {
                const promise = canvas.buyPixels([{ ...input, color: 0xffffffff }], url, { value });
                await expect(promise).to.eventually.be.rejectedWith('Color is invalid');
            });
    
            it('should fail if insufficient funds were paid', async () => {
                const promise = canvas.buyPixels([input], url, { value: toWei(0) });
                await expect(promise).to.eventually.be.rejectedWith('Insufficient ether');
            });
    
            it('should fail if pixel is already purchased', async () => {
                await canvas.buyPixels([input], url, { value });
                const promise = canvas.buyPixels([input], url, { value, from: buyer });
                await expect(promise).to.eventually.be.rejectedWith('Pixel already purchased');
            });

            describe('multiple', () => {

                it('should fail if one of multiple pixels fails', async () => {
                    const validInput = input;
                    const invalidInput: PixelInput = { ...validInput, x: -1 };
                    const promise = canvas.buyPixels([validInput, invalidInput], url, { value });
                    await expect(promise).to.eventually.be.rejectedWith('Pixel is out of bounds');

                    const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                    assert.equal(balance, 0);

                    const validPixel: Pixel = await canvas.pixels(validInput.x, validInput.y) as any;
                    const invalidPixel: Pixel = await canvas.pixels(invalidInput.x, invalidInput.y) as any;
                    assert.isFalse(validPixel.exists);
                    assert.isFalse(invalidPixel.exists);
                });

            });

        });

        describe('success', () => {
            
            it('should register pixel', async () => {
                await canvas.buyPixels([input], url, { value, from: buyer });
                const pixel: Pixel = await canvas.pixels(input.x, input.y) as any;
                assert.isTrue(pixel.exists);
                assert.equal(pixel.x.toNumber(), input.x);
                assert.equal(pixel.y.toNumber(), input.y);
                assert.equal(pixel.url, url);
                assert.equal(pixel.color.toNumber(), input.color);
                assert.equal(pixel.owner, buyer);
            });

            it('should add balance to the contract', async () => {
                // const balanceBefore = await web3.eth.getBalance(buyer).then(toEth);
                await canvas.buyPixels([input], url, { value });
                // const balanceAfter = await web3.eth.getBalance(buyer).then(toEth);
                const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balance, pricePerPixel);
            });
            
            it('should send back excess ether', async () => {
                await canvas.buyPixels([input], url, { value: toWei(pricePerPixel * 2) });
                const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balance, pricePerPixel);
            });

            it('should allow updating pixels', async () => {
                const updatedColor = 0x133337;
                await canvas.buyPixels([input], url, { value, from: buyer });
                await canvas.buyPixels([{ ...input, color: updatedColor }], url, { value, from: buyer });
                // only increase the balance once, not for the update
                const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                assert.equal(balance, pricePerPixel);

                const pixel: Pixel = await canvas.pixels(input.x, input.y) as any;
                assert.equal(pixel.color.toNumber(), updatedColor);
            });

            describe('multiple', () => {

                it('should register multiple pixels', async () => {
                    const inputs: PixelInput[] = [
                        { x: 0, y: 0, color: 0xff0033 },
                        { x: 1, y: 0, color: 0xff0033 },
                    ];

                    await canvas.buyPixels(inputs, url, { value: toWei(pricePerPixel * 2) });
                    const pixels: Pixel[] = await Promise.all(inputs.map((i) => canvas.pixels(i.x, i.y) as any));
                    assert.isTrue(pixels[0].exists);
                    assert.isTrue(pixels[1].exists);

                    const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                    assert.equal(balance, pricePerPixel * 2);
                });
                
                it('should not charge twice when sending a duplicate pixel', async () => {
                    await canvas.buyPixels([input, input], url, { value: toWei(pricePerPixel * 2) });
                    const balance = await web3.eth.getBalance(canvas.address).then(toEth);
                    assert.equal(balance, pricePerPixel);
                });

            });

        });

    });

});
