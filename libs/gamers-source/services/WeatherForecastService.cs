namespace GamersSourceServices;

public sealed class WeatherForecastService(TimeProvider clock, Random random)
{
    private static readonly string[] Summaries =
    [
        "Freezing", "Bracing", "Chilly", "Cool", "Mild", "Warm", "Balmy", "Hot", "Sweltering", "Scorching"
    ];

    public WeatherForecast[] GetForecast(int days)
    {
        var today = DateOnly.FromDateTime(clock.GetLocalNow().DateTime);

        return [.. Enumerable.Range(1, days).Select(index => new WeatherForecast(
            today.AddDays(index),
            random.Next(-20, 55),
            Summaries[random.Next(Summaries.Length)]))];
    }
}
