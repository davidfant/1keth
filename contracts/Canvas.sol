pragma solidity ^0.5.0;
pragma experimental ABIEncoderV2;

contract Canvas {

    // 2D array mapping a pixel at pixels[x][y]
    // to a hex representation of a hex string.
    mapping (uint256 => mapping (uint256 => Pixel)) public pixels;
    uint256 public width;
    uint256 public height;
    uint256 public pricePerPixel;
    // This will be assigned at contract creation
    address public owner = msg.sender;

    constructor(uint256 _width, uint256 _height, uint256 _pricePerPixel) public {
        width = _width;
        height = _height;
        pricePerPixel = _pricePerPixel;
    }

    struct Pixel {
        uint256 x;
        uint256 y;
        string url;
        uint32 color;
        address owner;
        bool exists;
    }

    struct PixelInput {
        uint256 x;
        uint256 y;
        uint32 color;
    }

    function buyPixels(PixelInput[] memory inputs, string memory url) public payable {
        require(inputs.length > 0, "No pixels provided");

        uint256 newPixels = 0;

        for (uint i = 0; i < inputs.length; i++) {
            PixelInput memory p = inputs[i];
            Pixel memory pixel = pixels[p.x][p.y];
            require(0 <= p.x && p.x < width && 0 <= p.y && p.y < height, "Pixel is out of bounds");
            require(0x000000 <= p.color && p.color <= 0xffffff, "Color is invalid");
            require(!pixel.exists || pixel.owner == msg.sender, "Pixel already purchased");

            if (!pixel.exists) {
                newPixels++;
            }

            pixels[p.x][p.y] = Pixel({
                x: p.x,
                y: p.y,
                url: url,
                color: p.color,
                owner: msg.sender,
                exists: true
            });
        }

        uint256 price = newPixels * pricePerPixel;
        require(msg.value >= price, "Insufficient ether");
        msg.sender.transfer(msg.value - price);
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "Sender not authorized.");
        // "_;" will be replaced by the actual fucntion body when the modifier is used.
        _;
    }

    // https://solidity.readthedocs.io/en/v0.4.24/common-patterns.html#restricting-access
    function withdraw(uint256 amount) public onlyOwner returns (bool) {
        uint256 balance = address(this).balance;
        require(amount <= balance, "Insufficient funds");
        msg.sender.transfer(amount);
        return true;

    }
}
