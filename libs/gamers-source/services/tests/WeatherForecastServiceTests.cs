namespace GamersSourceServices.Tests;

public class WeatherForecastServiceTests
{
    private static WeatherForecastService CreateService() =>
        new(new FixedTimeProvider(new DateTimeOffset(2026, 10, 27, 12, 0, 0, TimeSpan.Zero)), new Random(1));

    [Fact]
    public void GetForecast_ReturnsOneEntryPerRequestedDay()
    {
        Assert.Equal(5, CreateService().GetForecast(5).Length);
    }

    [Fact]
    public void GetForecast_StartsTheDayAfterToday()
    {
        var forecast = CreateService().GetForecast(2);

        Assert.Equal(new DateOnly(2026, 10, 28), forecast[0].Date);
        Assert.Equal(new DateOnly(2026, 10, 29), forecast[1].Date);
    }

    [Fact]
    public void GetForecast_KeepsTemperaturesInRange()
    {
        Assert.All(CreateService().GetForecast(50), entry => Assert.InRange(entry.TemperatureC, -20, 54));
    }

    [Fact]
    public void GetForecast_GivesEveryEntryASummary()
    {
        Assert.All(CreateService().GetForecast(50), entry => Assert.False(string.IsNullOrEmpty(entry.Summary)));
    }

    [Theory]
    [InlineData(0, 32)]
    [InlineData(100, 211)]
    public void TemperatureF_ConvertsFromCelsius(int celsius, int fahrenheit)
    {
        Assert.Equal(fahrenheit, new WeatherForecast(new DateOnly(2026, 10, 27), celsius, null).TemperatureF);
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;

        public override TimeZoneInfo LocalTimeZone => TimeZoneInfo.Utc;
    }
}
