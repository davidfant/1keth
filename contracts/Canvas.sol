pragma solidity ^0.6.1;

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

    function buyPixels(
        uint256 x0, uint256 y0,
        uint256 x1, uint256 y1,
        uint32[] memory colors,
        string memory url
    ) public payable {
        // We assume that the pixel range input comes in in the correct order
        require(x0 <= x1 && y0 <= y1, "Pixel range is invalid");
        require(0 <= x0 && x1 < width && 0 <= y0 && y1 < height, "Pixel range is out of bounds");

        uint256 cols = x1 - x0 + 1;
        uint256 rows = y1 - y0 + 1;
        require(colors.length == cols * rows, "Number of colors is invalid");

        for (uint256 i = 0; i < colors.length; i++) {
            require(0x000000 <= colors[i] && colors[i] <= 0xffffff, "Color is invalid");
        }

        uint256 numNewPixels = 0;

        for (uint256 row = 0; row < rows; row++) {
            uint256 y = y0 + row;
            for (uint256 col = 0; col < cols; col++) {
                uint256 x = x0 + col;
                // Colors should be sorted like [[x0, y0], [x1, y0], ..., [xn-1, yn], [xn, yn]]
                uint256 colorIndex = col + row * cols;
                uint32 color = colors[colorIndex];

                Pixel memory pixel = pixels[x][y];
                require(!pixel.exists || pixel.owner == msg.sender, "Pixel already purchased");

                if (!pixel.exists) {
                    numNewPixels++;
                }

                pixels[x][y] = Pixel({
                    x: x,
                    y: y,
                    url: url,
                    color: color,
                    owner: msg.sender,
                    exists: true
                });
            }
        }

        uint256 price = numNewPixels * pricePerPixel;
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
