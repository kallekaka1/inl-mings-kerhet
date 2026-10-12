
using System.ComponentModel.DataAnnotations;
using JensenOnline.Api.Data;
using JensenOnline.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JensenOnline.Api.Controllers;

[ApiController]
[Authorize]
[Route("api/orders")]
public class OrdersController : ControllerBase
{
    private readonly AppDbContext _db;
    private readonly UserManager<ApplicationUser> _users;

    public OrdersController(
        AppDbContext db,
        UserManager<ApplicationUser> users)
    {
        _db = db;
        _users = users;
    }

    // Skapa order som inloggad användare
    [HttpPost]
    public async Task<IActionResult> CreateOrder(
        CreateOrderRequest request)
    {
        var userId = _users.GetUserId(User);

        if (userId == null)
            return Unauthorized();

        if (request.Items == null ||
            request.Items.Count < 1 ||
            request.Items.Count > 25)
        {
            return BadRequest(new
            {
                message = "Order must contain 1-25 items."
            });
        }

        if (request.Items.Any(i =>
            i == null ||
            i.ProductId <= 0 ||
            i.Quantity < 1 ||
            i.Quantity > 100))
        {
            return BadRequest(new
            {
                message = "Invalid order items."
            });
        }

        var ids = request.Items
            .Select(i => i.ProductId)
            .ToList();

        if (ids.Distinct().Count() != ids.Count)
        {
            return BadRequest(new
            {
                message = "Duplicate products are not allowed."
            });
        }

        var products = await _db.Products
            .AsNoTracking()
            .Where(p => ids.Contains(p.Id))
            .ToListAsync();

        if (products.Count != ids.Count)
        {
            return BadRequest(new
            {
                message = "One or more products do not exist."
            });
        }

        var productMap = products.ToDictionary(p => p.Id);

        var order = new Order
        {
            UserId = userId,
            Items = request.Items.Select(item => new OrderItem
            {
                ProductId = item.ProductId,
                Quantity = item.Quantity,
                UnitPrice = productMap[item.ProductId].Price
            }).ToList()
        };

        // Priset beräknas alltid på servern
        order.TotalPrice = order.Items.Sum(
            item => item.UnitPrice * item.Quantity);

        _db.Orders.Add(order);
        await _db.SaveChangesAsync();

        return Created($"/api/orders/{order.Id}", new
        {
            order.Id,
            order.CreatedAt,
            order.TotalPrice
        });
    }

    // Visa endast inloggad användares order
    [HttpGet]
    public async Task<IActionResult> GetMyOrders()
    {
        var userId = _users.GetUserId(User);

        if (userId == null)
            return Unauthorized();

        var orders = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .ThenInclude(i => i.Product)
            .Where(o => o.UserId == userId)
            .OrderByDescending(o => o.CreatedAt)
            .Take(100)
            .ToListAsync();

        return Ok(orders.Select(FormatOrder));
    }

    // Visa en order endast om användaren äger den
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetOrder(int id)
    {
        var userId = _users.GetUserId(User);

        if (userId == null)
            return Unauthorized();

        var order = await _db.Orders
            .AsNoTracking()
            .Include(o => o.Items)
            .ThenInclude(i => i.Product)
            .FirstOrDefaultAsync(o =>
                o.Id == id && o.UserId == userId);

        if (order == null)
            return NotFound();

        return Ok(FormatOrder(order));
    }

    private static object FormatOrder(Order order)
    {
        return new
        {
            order.Id,
            order.CreatedAt,
            order.TotalPrice,
            Items = order.Items.Select(item => new
            {
                item.ProductId,
                ProductName = item.Product.Name,
                item.Quantity,
                item.UnitPrice
            }).ToList()
        };
    }
}

public class CreateOrderRequest
{
    [Required]
    [MinLength(1)]
    [MaxLength(25)]
    public List<CreateOrderItemRequest> Items { get; set; } = new();
}

public class CreateOrderItemRequest
{
    [Range(1, int.MaxValue)]
    public int ProductId { get; set; }

    [Range(1, 100)]
    public int Quantity { get; set; }
}
