
using System.ComponentModel.DataAnnotations;
using JensenOnline.Api.Data;
using JensenOnline.Api.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace JensenOnline.Api.Controllers;

[ApiController]
[Route("api/products")]
public class ProductsController : ControllerBase
{
    private readonly AppDbContext _db;

    public ProductsController(AppDbContext db)
    {
        _db = db;
    }

    // Alla kan visa och söka produkter
    [AllowAnonymous]
    [HttpGet]
    public async Task<IActionResult> GetProducts(
        [FromQuery] string? search)
    {
        var query = _db.Products.AsNoTracking();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim();

            query = query.Where(p =>
                p.Name.Contains(term));
        }

        var products = await query
            .OrderBy(p => p.Id)
            .Take(100)
            .ToListAsync();

        return Ok(products);
    }

    // Endast admin får skapa produkter
    [Authorize(Roles = "Admin")]
    [HttpPost]
    public async Task<IActionResult> CreateProduct(
        ProductRequest request)
    {
        var product = new Product
        {
            Name = request.Name.Trim(),
            Description = request.Description.Trim(),
            Price = request.Price
        };

        _db.Products.Add(product);
        await _db.SaveChangesAsync();

        return Created($"/api/products/{product.Id}", product);
    }

    // Endast admin får ändra produkter
    [Authorize(Roles = "Admin")]
    [HttpPut("{id:int}")]
    public async Task<IActionResult> UpdateProduct(
        int id, ProductRequest request)
    {
        var product = await _db.Products.FindAsync(id);

        if (product == null)
            return NotFound();

        product.Name = request.Name.Trim();
        product.Description = request.Description.Trim();
        product.Price = request.Price;

        await _db.SaveChangesAsync();

        return Ok(product);
    }

    [AllowAnonymous]
    [HttpGet("{id:int}")]
    public async Task<IActionResult> GetProduct(int id)
    {
        var product = await _db.Products.FindAsync(id);

        if (product == null)
            return NotFound();

        return Ok(product);
    }
}

public class ProductRequest
{
    [Required]
    [StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [StringLength(500)]
    public string Description { get; set; } = string.Empty;

    [Range(typeof(decimal), "0.01", "1000000")]
    public decimal Price { get; set; }
}
